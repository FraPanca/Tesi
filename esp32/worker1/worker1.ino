#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <string.h>
#include "config.h"

#define WORKER_ID 1

#if WORKER_ID == 1
  #define TOPIC_SUBSCRIBE TOPIC_WORKER1_INTERNAL
#else
  #define TOPIC_SUBSCRIBE TOPIC_WORKER2_INTERNAL
#endif


WiFiClient espClient;
PubSubClient client(espClient);

struct GruppoPresa {
  bool attivo = false;
  String presaId;
  float riferimentoPotenza = 0;
  float sommaPotenza = 0, sommaTensione = 0, sommaCorrente = 0;
  uint32_t conteggio = 0;

  // Epoch UTC (secondi, float lato gateway -> double qui per precisione) dei campioni raw.
  // Solo per il campo pubblicato in optimized, NON usato per il timeout interno del gruppo (vedi millisUltimoArrivo).
  double timestampInizio = 0;
  double timestampUltimo = 0;
  uint32_t millisUltimoArrivo = 0; // millis() locale: usato SOLO per il timeout interno

  // Campione fuori soglia non ancora confermato/smentito dal successivo.
  bool sospetto = false;
  float potenzaCandidata = 0, tensioneCandidata = 0, correnteCandidata = 0;
  double tsCandidato = 0;
  uint32_t millisCandidato = 0;
};

GruppoPresa gruppi[MAX_PRESE];


struct MessaggioPendente {
  bool inUso = false;
  char topic[48];
  char payload[256];
  size_t lunghezza = 0;
  uint32_t millisPrimoTentativo = 0;
};

MessaggioPendente pendenti[MAX_PENDENTI];


bool accodaPendente(const char* topic, const uint8_t* payload, size_t lunghezza) {
  for (int i = 0; i < MAX_PENDENTI; i++) {
    if (!pendenti[i].inUso) {
      strncpy(pendenti[i].topic, topic, sizeof(pendenti[i].topic) - 1);
      pendenti[i].topic[sizeof(pendenti[i].topic) - 1] = '\0';
      pendenti[i].lunghezza = min(lunghezza, sizeof(pendenti[i].payload));
      memcpy(pendenti[i].payload, payload, pendenti[i].lunghezza);
      pendenti[i].millisPrimoTentativo = millis();
      pendenti[i].inUso = true;
      return true;
    }
  }
  return false; // coda piena
}

void ritentaPendenti() {
  if (!client.connected()) return;
  uint32_t ora = millis();
  for (int i = 0; i < MAX_PENDENTI; i++) {
    if (!pendenti[i].inUso) continue;

    if (client.publish(pendenti[i].topic, (const uint8_t*)pendenti[i].payload, pendenti[i].lunghezza)) {
      pendenti[i].inUso = false;
    } else if ((ora - pendenti[i].millisPrimoTentativo) > TIMEOUT_PENDENTE_MS) {
      Serial.printf("ERRORE: dato optimized perso definitivamente su %s dopo %lus di tentativi\n", pendenti[i].topic, TIMEOUT_PENDENTE_MS / 1000UL);
      pendenti[i].inUso = false;
    }
  }
}

int trovaOCreaGruppo(const String& presaId) {
  for (int i = 0; i < MAX_PRESE; i++) {
    if (gruppi[i].attivo && gruppi[i].presaId == presaId) return i;
  }
  for (int i = 0; i < MAX_PRESE; i++) {
    if (!gruppi[i].attivo) return i;
  }
  return -1; // nessuno slot libero
}

bool letturaValida(float potenza, float tensione, float corrente) {
  if (isnan(potenza) || isnan(tensione) || isnan(corrente)) return false;
  if (potenza < 0 || potenza > POWER_MAX_W) return false;
  if (tensione < VOLTAGE_MIN_V || tensione > VOLTAGE_MAX_V) return false;
  if (corrente < 0 || corrente > CURRENT_MAX_A) return false;
  return true;
}

bool compatibileConRiferimento(float riferimento, float potenza) {
  float soglia = max(SOGLIA_ASSOLUTA_W, fabs(riferimento) * SOGLIA_PERCENTUALE);
  return fabs(potenza - riferimento) <= soglia;
}

void aggiungiAlGruppo(GruppoPresa& g, float potenza, float tensione, float corrente, double ts) {
  g.sommaPotenza += potenza;
  g.sommaTensione += tensione;
  g.sommaCorrente += corrente;
  g.conteggio++;
  g.timestampUltimo = ts;
  g.millisUltimoArrivo = millis();
}

void avviaGruppo(GruppoPresa& g, const String& presaId, float potenza, float tensione, float corrente, double ts) {
  g.attivo = true;
  g.presaId = presaId;
  g.riferimentoPotenza = potenza;
  g.sommaPotenza = potenza;
  g.sommaTensione = tensione;
  g.sommaCorrente = corrente;
  g.conteggio = 1;
  g.timestampInizio = ts;
  g.timestampUltimo = ts;
  g.millisUltimoArrivo = millis();
  g.sospetto = false;
}

void pubblicaOttimizzato(GruppoPresa& g) {
  if (g.conteggio == 0) return;

  JsonDocument doc;
  doc["presa_id"] = g.presaId;
  doc["power_w"] = g.sommaPotenza / g.conteggio;
  doc["voltage_v"] = g.sommaTensione / g.conteggio;
  doc["current_a"] = g.sommaCorrente / g.conteggio;
  doc["sample_count"] = g.conteggio;
  doc["timestamp_start"] = g.timestampInizio;
  doc["timestamp_end"] = g.timestampUltimo;

  char buffer[256];
  size_t n = serializeJson(doc, buffer);

  String topic = "home/" + g.presaId + "/optimized";
  if (!client.publish(topic.c_str(), (const uint8_t*)buffer, n)) {
    if (!accodaPendente(topic.c_str(), (const uint8_t*)buffer, n)) {
      Serial.println("ERRORE: pubblicazione fallita e coda pendenti piena, dato perso subito: " + topic);
    }
  }

  g.attivo = false;
  g.conteggio = 0;
  g.sommaPotenza = g.sommaTensione = g.sommaCorrente = 0;
}

// Pubblica il gruppo accumulato finora SENZA il candidato, poi ne apre uno nuovo a partire dal candidato (che diventa il primo campione).
void chiudiEApriConCandidato(GruppoPresa& g) {
  pubblicaOttimizzato(g);
  avviaGruppo(g, g.presaId, g.potenzaCandidata, g.tensioneCandidata, g.correnteCandidata, g.tsCandidato);
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("JSON malformato, scarto: %s\n", err.c_str());
    return;
  }

  // Nomi campo allineati a gateway/src/devices/device_monitor.py
  String presaId = doc["deviceId"].as<String>();
  double ts = doc["timestamp"].as<double>();
  float potenza = doc["power"].as<float>();
  float tensione = doc["voltage"].as<float>();
  float corrente = doc["current"].as<float>();

  if (presaId.length() == 0) {
    Serial.println("Payload senza deviceId, scarto");
    return;
  }

  if (!letturaValida(potenza, tensione, corrente)) {
    Serial.println("Lettura fuori range fisico, scartata (errore di lettura)");
    return;
  }

  int idx = trovaOCreaGruppo(presaId);
  if (idx < 0) return;

  GruppoPresa& g = gruppi[idx];

if (!g.attivo) {
    avviaGruppo(g, presaId, potenza, tensione, corrente, ts);
    return;
  }

  if (!g.sospetto) {
    if (compatibileConRiferimento(g.riferimentoPotenza, potenza)) {
      aggiungiAlGruppo(g, potenza, tensione, corrente, ts);
    } else {
      // Campione in sospeso in attesa del prossimo.
      g.sospetto = true;
      g.potenzaCandidata = potenza;
      g.tensioneCandidata = tensione;
      g.correnteCandidata = corrente;
      g.tsCandidato = ts;
      g.millisCandidato = millis();
      g.millisUltimoArrivo = millis();
    }
    return;
  }

  // Candidato in sospeso: questo campione lo conferma o lo smentisce.
  g.millisUltimoArrivo = millis();

  if (compatibileConRiferimento(g.riferimentoPotenza, potenza)) {
    // Candidato falso positivo isolato.
    g.sospetto = false;
    aggiungiAlGruppo(g, potenza, tensione, corrente, ts);
    return;
  }

  if (compatibileConRiferimento(g.potenzaCandidata, potenza)) {
    // Candidato confermato da due letture consecutive.
    chiudiEApriConCandidato(g);
    aggiungiAlGruppo(g, potenza, tensione, corrente, ts);
    return;
  }

  // Né il vecchio riferimento né il candidato spiegano questo campione: il candidato resta promosso, il campione corrente diventa il nuovo sospetto.
  chiudiEApriConCandidato(g);
  g.sospetto = true;
  g.potenzaCandidata = potenza;
  g.tensioneCandidata = tensione;
  g.correnteCandidata = corrente;
  g.tsCandidato = ts;
  g.millisCandidato = millis();
}

void controllaTimeout() {
  uint32_t ora = millis();
  for (int i = 0; i < MAX_PRESE; i++) {
    if (!gruppi[i].attivo) continue;

    if (gruppi[i].sospetto && (ora - gruppi[i].millisCandidato) > TIMEOUT_GRUPPO_MS) {
      // Nessuna conferma/smentita arrivata in tempo: il candidato diventa definitivo.
      chiudiEApriConCandidato(gruppi[i]);
      continue;
    }

    if ((ora - gruppi[i].millisUltimoArrivo) > TIMEOUT_GRUPPO_MS) {
      pubblicaOttimizzato(gruppi[i]);
    }
  }
}

void connettiWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connessione WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" OK");
}

void connettiMQTT() {
  String clientId = "esp32-worker" + String(WORKER_ID);
  while (!client.connected()) {
    Serial.print("Connessione MQTT...");
    if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("OK");
      client.subscribe(TOPIC_SUBSCRIBE);
    } else {
      Serial.printf("fallita, rc=%d, riprovo tra 2s\n", client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  connettiWiFi();

  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(onMessage);
  client.setBufferSize(512); // default PubSubClient è 256B, insufficiente per JSON

  connettiMQTT();
}

void loop() {
  if (!client.connected()) {
    connettiMQTT();
  }
  client.loop();
  controllaTimeout();
  ritentaPendenti();
}
