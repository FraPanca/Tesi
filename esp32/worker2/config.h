#ifndef CONFIG_H
#define CONFIG_H

#include "secrets.h"                    // WIFI_SSID, WIFI_PASSWORD, MQTT_BROKER

#define MQTT_PORT     1883

// --- Topic MQTT ---
#define TOPIC_RAW_WILDCARD     "home/+/raw"          // sottoscritto dal load balancer
#define TOPIC_WORKER1_INTERNAL "home/lb/worker1/raw" // topic interno LB -> worker1
#define TOPIC_WORKER2_INTERNAL "home/lb/worker2/raw" // topic interno LB -> worker2
// home/<presa_id>/optimized viene costruito dinamicamente dal worker a runtime

// --- Parametri algoritmo di ottimizzazione (worker) ---
// Soglia ibrida: tolleranza = max(SOGLIA_ASSOLUTA_W, riferimento * SOGLIA_PERCENTUALE).
// Sotto ~SOGLIA_ASSOLUTA_W/SOGLIA_PERCENTUALE Watt domina la soglia fissa, sopra domina quella percentuale (coi default: punto di passaggio a 50W).
#define SOGLIA_ASSOLUTA_W      1.0f     // tolleranza fissa (W), usata a bassa potenza
#define SOGLIA_PERCENTUALE     0.02f    // tolleranza relativa (+-2%), usata ad alta potenza
#define TIMEOUT_GRUPPO_MS      30000UL  // se non arrivano campioni compatibili entro 30s, chiudi il gruppo
#define MAX_PRESE              8        // numero massimo di prese gestibili in parallelo da un worker
#define MAX_PENDENTI           4        // messaggi optimized in coda dopo un fallimento di pubblicazione
#define TIMEOUT_PENDENTE_MS    60000UL  // dopo quanto tempo si rinuncia definitivamente a un pendente

// --- Limiti di validita' fisica (scarto errori di lettura) ---
#define POWER_MAX_W    3680.0f  // limite presa italiana standard (16A x 230V)
#define VOLTAGE_MIN_V  180.0f
#define VOLTAGE_MAX_V  260.0f
#define CURRENT_MAX_A  16.0f

#endif
