"""Gera n8n/avisos-prazo.json (workflow de avisos de prazo por WhatsApp).

Uso: python n8n/build_alertas.py
Depois de importar no n8n: escolher a credencial "Supabase" (host + service_role) nos nós Supabase
e conferir o Config (endereço do Supabase e link do sistema).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
LIDERHUB_CRED = {"id": "hTnvkqYGcd8A76vt", "name": "Liderhub API"}  # credencial já existente no n8n do cliente
SUPA = "={{ $('Config').first().json.supabaseUrl }}"
LIDER = "={{ $('Config').first().json.liderhubBase }}"

nodes, connections = [], {}


def node(name, ntype, version, params, pos, **extra):
    n = {"parameters": params, "name": name, "type": ntype, "typeVersion": version, "position": pos}
    n.update(extra)
    nodes.append(n)


def code(name, js, pos, each=False, **extra):
    p = {"jsCode": js}
    if each:
        p["mode"] = "runOnceForEachItem"
    node(name, "n8n-nodes-base.code", 2, p, pos, **extra)


def http(name, pos, url, method="GET", auth="liderhub", body=None, headers=None, **extra):
    p = {"method": method, "url": url, "options": {}}
    if auth == "liderhub":
        p.update({"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth"})
        extra.setdefault("credentials", {"httpHeaderAuth": LIDERHUB_CRED})
    else:
        p.update({"authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi"})
    if headers:
        p["sendHeaders"] = True
        p["headerParameters"] = {"parameters": [{"name": k, "value": v} for k, v in headers]}
    if body:
        p.update({"sendBody": True, "specifyBody": "json", "jsonBody": body})
    extra.setdefault("retryOnFail", True)
    extra.setdefault("maxTries", 3)
    extra.setdefault("waitBetweenTries", 3000)
    node(name, "n8n-nodes-base.httpRequest", 4.2, p, pos, **extra)


def link(a, b):
    connections.setdefault(a, {"main": [[]]})["main"][0].append({"node": b, "type": "main", "index": 0})


node("Dias úteis às 8h", "n8n-nodes-base.scheduleTrigger", 1.2,
     {"rule": {"interval": [{"field": "cronExpression", "expression": "0 8 * * 1-5"}]}}, [0, 300])

code("Config", r"""return [{ json: {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co', // endereço do projeto Supabase
  liderhubBase: 'https://api.liderhub.com.br',
  numeroConexao: '24992595948', // número do escritório conectado no Liderhub (final)
  prefixo: '[Controle de Prazos]',
  linkSistema: 'https://SEU-SISTEMA.vercel.app/contratos', // link para abrir o sistema
} }];""", [220, 300])

http("Supabase alertas do dia", [440, 300], SUPA + "/rest/v1/alertas_pendentes?select=*", auth="supabase")
http("Supabase administradores", [660, 300],
     SUPA + "/rest/v1/perfis?select=nome,whatsapp&papel=eq.admin&ativo=eq.true", auth="supabase", executeOnce=True,
     alwaysOutputData=True)
http("Liderhub conexões", [880, 300], LIDER + "/v1/connections", executeOnce=True)

# "Montar avisos" lê os alertas do nó "Supabase alertas do dia" (não do nó anterior).
src = (HERE / "src" / "montar_avisos.js").read_text(encoding="utf-8").replace(
    "$input.all()", "$('Supabase alertas do dia').all()")
code("Montar avisos", src, [1100, 300])

http("Liderhub contato do responsável", [1320, 300], LIDER + "/v1/contacts", method="POST",
     body="={{ JSON.stringify({ connection: $json.connection, number: $json.numero, name: $json.nome }) }}",
     onError="continueRegularOutput")
http("Liderhub enviar aviso", [1540, 300], LIDER + "/v1/send/message", method="POST",
     body="={{ JSON.stringify({ contact: $json.id, content: $('Montar avisos').item.json.texto, messageType: 'conversation' }) }}",
     onError="continueRegularOutput")
code("Só enviados", r"""return $input.all()
  .map((r, i) => ({ r, a: $('Montar avisos').all()[r.pairedItem?.item ?? i].json }))
  .filter(({ r }) => r.json && r.json.id && !r.json.error)
  .map(({ a }) => ({ json: { contrato_id: a.contrato_id, tipo: a.tipo, destino: a.numero } }));""", [1760, 300])
http("Supabase registrar envio", [1980, 300], SUPA + "/rest/v1/alertas_enviados", method="POST", auth="supabase",
     body="={{ JSON.stringify($json) }}", headers=[("Prefer", "resolution=ignore-duplicates,return=minimal")])

node("Leia-me", "n8n-nodes-base.stickyNote", 1, {"width": 560, "height": 260, "content": (
    "## Avisos de prazo (Controle de Distribuição)\n"
    "Dias úteis às 8h: lê a view `alertas_pendentes` no Supabase e envia pelo Liderhub um WhatsApp ao responsável "
    "de cada contrato: 3 dias antes, véspera, dia do prazo, 1 dia de atraso e N dias de atraso (configurável no sistema).\n\n"
    "Cada aviso é registrado em `alertas_enviados` e nunca é enviado duas vezes. Sem responsável/WhatsApp → vai para os administradores.\n\n"
    "**Credenciais:** `Liderhub API` e `Supabase` (host + service_role key).")}, [0, -40])

for a, b in [
    ("Dias úteis às 8h", "Config"), ("Config", "Supabase alertas do dia"),
    ("Supabase alertas do dia", "Supabase administradores"), ("Supabase administradores", "Liderhub conexões"),
    ("Liderhub conexões", "Montar avisos"), ("Montar avisos", "Liderhub contato do responsável"),
    ("Liderhub contato do responsável", "Liderhub enviar aviso"), ("Liderhub enviar aviso", "Só enviados"),
    ("Só enviados", "Supabase registrar envio"),
]:
    link(a, b)

wf = {
    "name": "Avisos de prazo - Controle de Distribuição",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo", "saveManualExecutions": True},
    "pinData": {},
}
out = HERE / "avisos-prazo.json"
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"{out} ({len(nodes)} nós)")
