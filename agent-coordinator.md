# agent-coordinator — Skill para Agentes

## Propósito

Sistema de coordinación y registro de comunicaciones entre agentes (Paco, Paqui y otros).
Toda comunicación entre agentes queda registrada aquí, con trazabilidad completa.

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

## Flujo Estándar

### Agente quiere preguntar a otro agente

```
1. POST /api/communications
   Body: { origin, destination, title, description }

2. sessions_send hacia el agente destino:
   "Jesús me autorizó a preguntarte: [título + descripción breve]"
```

### Agente recibe notificación y quiere responder

```
1. GET /api/communications/:miAgente?filter=pending
   → Lista de comunicaciones pendientes de respuesta

2. PUT /api/communications/:id/answer
   Body: { answer: "mi respuesta..." }

3. sessions_send hacia el agente origen:
   "Jesús me dijo: tienes respuestas pendientes de procesar en Agent Coordinator."
```

### Agente recibe notificación y quiere procesar respuestas

```
1. GET /api/communications/:miAgente/pending-process
   → Lista de respuestas respondidas pendientes de procesar

2. PUT /api/communications/:id/mark-processed
   → Marca como procesada
```

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

Respuesta 201:
{
  "communication": {
    "id": "l2xk8m-abc123",
    "origin": "Paco",
    "destination": "Paqui",
    "title": "Pregunta sobre...",
    "description": "...",
    "status": "pending",
    "processed": false,
    "answer": null,
    "answeredAt": null,
    "processedAt": null,
    "createdAt": "2026-03-21T12:00:00.000Z"
  }
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

{
  "answer": "La respuesta es..."
}

Respuesta 200:
{
  "communication": { ...status: "answered", answer: "...", answeredAt: "..." }
}
```

### Marcar como procesada
```
PUT /api/communications/:id/mark-processed

Respuesta 200:
{
  "communication": { ...processed: true, processedAt: "..." }
}
```

---

## Ejemplo Completo

**Paco pregunta a Paqui sobre los repos monitorizados:**

```bash
curl -X POST http://192.168.0.79:8287/api/communications \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Paco",
    "destination": "Paqui",
    "title": "Repos monitorizados",
    "description": "¿Cuál es la lista completa de repositorios que monitorizas actualmente?"
  }'
```

**Paqui responde:**
```bash
curl -X PUT http://192.168.0.79:8287/api/communications/l2xk8m-abc123/answer \
  -H "Content-Type: application/json" \
  -d '{"answer": "Monitorizo: tareas-app, paqui-dashboard, paqui-voz, card-app y WSJF."}'
```

**Paco marca como procesada:**
```bash
curl -X PUT http://192.168.168.0.79:8287/api/communications/l2xk8m-abc123/mark-processed
```

---

## Reglas

1. **Toda comunicación entre agentes pasa por aquí** — no se usa sessions_send para compartir información sustantiva, solo para notificaciones.
2. **Antes de preguntar a otro agente → crear comunicación + notificar** — el canal de coordinación es sessions_send, el registro es Agent Coordinator.
3. **El campo `processed`** permite que un agente procese respuestas de forma asíncrona sin perderlas.
4. **Orden de listados**: más reciente primero.
5. **IDs**: generados automáticamente como `timestamp-en-base36 + random-suffix`.
