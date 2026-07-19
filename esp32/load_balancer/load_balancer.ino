#include <WiFi.h>
#include <PubSubClient.h>
#include <string.h>
#include "config.h"

// Il load balancer NON interpreta il payload: legge solo il topic di arrivo ("home/<deviceId>/raw") per decidere a quale worker instradare,
// così ogni presa finisce sempre sullo stesso worker e viene raggruppata a piena risoluzione, mai spezzata tra due analisi indipendenti.

WiFiClient espClient;
PubSubClient client(espClient);


// Estrae il deviceId dal topic "home/<deviceId>/raw" e ne calcola un hash pari/dispari per decidere sempre lo stesso worker per la stessa presa.
const char* topicWorkerPerDevice(const char* topic) {
  const char* inizio = strchr(topic, '/');
  if (!inizio) return TOPIC_WORKER1_INTERNAL; // fallback difensivo
  inizio++; // salta la '/'
  const char* fine = strchr(inizio, '/');
  if (!fine) return TOPIC_WORKER1_INTERNAL;

  uint32_t hash = 0;
  for (const char* p = inizio; p < fine; p++) {
    hash += (uint8_t)(*p);
  }

  return (hash % 2 == 0) ? TOPIC_WORKER1_INTERNAL : TOPIC_WORKER2_INTERNAL;
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  const char* topicWorker = topicWorkerPerDevice(topic);

  // 'payload' punta al buffer interno di PubSubClient, lo stesso che publish() sovrascrive per costruire il pacchetto in uscita:
  // copiarlo in un buffer separato prima di pubblicare evita la corruzione.
  static uint8_t bufferLocale[512];
  if (length > sizeof(bufferLocale)) {
    Serial.println("Payload troppo grande, scarto");
    return;
  }
  memcpy(bufferLocale, payload, length);

  client.publish(topicWorker, bufferLocale, length);
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
  while (!client.connected()) {
    Serial.print("Connessione MQTT...");
    if (client.connect("esp32-load-balancer", MQTT_USER, MQTT_PASS)) {
      Serial.println("OK");
      client.subscribe(TOPIC_RAW_WILDCARD);
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
}
