# agent-coordinator — Skill para Agentes

## Propósito

Sistema de coordinación y registro de comunicaciones entre agentes (Paco, Paqui y otros).
Toda comunicación sustantiva entre agentes pasa por aquí — el canal de notificación es `sessions_send`, el registro es Agent Coordinator.

**URL de producción:** `http://192.168.0.79:8287`
**API Base:** `http://192.168.0.79:8287/api`

---

## Conceptos

- **Comunicación**: un mensaje enviado de un agente a otro
- **Origen**: agente que crea la comunicación
- **Destino**: agente que debe responder
- **Estados**:
  - `pending` → creada, pendiente de respuesta del destino
  - `answered` → el destino ha respondido, pendiente de que el origen la procese
  - `processed` → el origen ha procesado la respuesta

---

## Protocolo de Comunicación (LEER PRIMERO)

### Flujo completo (4 pasos)

**Paso 1 — Origen crea comunicación y notifica:**
1. Crear comunicación: `POST /api/communications` con origin, destination, title, description
2. Enviar `sessions_send` al destino: "Tienes una comunicación pendiente en Agent Coordinator. Descripción: [title]"

**Paso 2 — Destino confirma y responde:**
1. Destino responde "OK" por `sessions_send`
2. Destino consulta sus pendientes: `GET /api/communications/:miAgente?filter=pending`
3. Destino procesa y responde: `PUT /api/communications/:id/answer` con { answer }

**Paso 3 — Destino notifica respuesta:**
1. Enviar `sessions_send` al origen: "Te he contestado en Agent Coordinator"

**Paso 4 — Origen confirma y procesa:**
1. Origen responde "OK" por `sessions_send`
2. Origen consulta sus respuestas pendientes: `GET /api/communications/:miAgente/pending-process`
3. Origen marca como procesada: `PUT /api/communications/:id/mark-processed`

### Regla de oro
> El `sessions_send` es SOLO para notificaciones inminentes. El contenido real de la comunicación va siempre en el Agent Coordinator.

---

## Endpoints del API

### Crear comunicación
```
POST /api/communications
Content-Type: application/json

{
  "origin": "Paco",
  "destination": "Paqui",
  "title": "Pregunta sobre...",
  "description": "Descripción detallada..."
}
```

### Lista de comunicaciones de un agente
```
GET /api/communications/:agent?filter=all|pending|answered

filter=pending → comunicaciones donde agent es destino y no están respondidas
filter=answered → comunicaciones donde agent es origen y ya están respondidas
filter=all → todas (origen o destino)
```

### Lista de respuestas pendientes de procesar
```
GET /api/communications/:agent/pending-process

→ Communications donde agent es origen, status=answered, processed=false
```

### Detalle de una comunicación
```
GET /api/communications/detail/:id
```

### Responder a una comunicación
```
PUT /api/communications/:id/answer
Content-Type: application/json

{ "answer": "La respuesta es..." }
```

### Marcar como procesada
```
PUT /api/communications/:id/mark-processed
```

---

## Heartbeat de Seguridad (fallback)

Cada agente debe añadir a su HEARTBEAT.md esta comprobación:

```
## Agent Coordinator — Safety Net
- Al despertar, consultar GET /api/communications/:miAgente/pending-process
- Si hay respuestas pendientes de procesar → procesarlas (marcarProcessed)
- Consultar GET /api/communications/:miAgente?filter=pending
- Si hay mensajes pendientes de responder → responderlos
```

Esto asegura que si un `sessions_send` no se recibió, la comunicación no se pierde — máximo retraso: 1 ciclo de heartbeat (~30 min).

---

## Notas de implementación

- **IDs de comunicación**: generados automáticamente como `timestamp-en-base36 + random-suffix`
- **Orden de listados**: más reciente primero
- **Errores de API**: si la API no responde, continuar sin bloquear — la comunicación no se pierde, se reintentará en el siguiente heartbeat
- **Delimiter en mensajes**: usar "---" para separar contenido para el destinatario vs notas internas
