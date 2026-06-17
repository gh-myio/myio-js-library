// Guard para a resposta do GET /v2/slaves.
//
// Pré-requisito: configure o nó "http request" do /v2/slaves para retornar
// "a UTF-8 string" (ret: "txt"), NÃO "Parse JSON". Assim o parse passa a ser
// feito aqui, com try/catch — e o corpo cru fica disponível para inspeção
// quando vier inválido/truncado (causa do "JSON parse error").
//
// 1 saída. Em caso de corpo inválido, descarta o ciclo (return null) e loga o
// trecho cru — sem derrubar o flow.

let body = msg.payload;

// Se o nó ainda estiver em "Parse JSON", body já vem objeto — segue direto.
if (typeof body === 'string') {
  try {
    body = JSON.parse(body);
  } catch (e) {
    // guarda o corpo cru pra diagnóstico (tamanho real x content-length ajuda a
    // confirmar truncamento)
    const len = (msg.headers && msg.headers['content-length']) || 'n/d';
    node.warn('[/v2/slaves] JSON inválido (content-length=' + len +
              ', recebido=' + body.length + ' bytes). Início: ' +
              body.slice(0, 200));
    node.error('parse-slaves: corpo nao-JSON, ciclo descartado', msg);
    return null; // descarta este ciclo; próximo polling tenta de novo
  }
}

if (!body || typeof body !== 'object' || !body.slaves) {
  node.warn('[/v2/slaves] payload sem .slaves; ciclo descartado');
  return null;
}

msg.payload = body;
return msg;
