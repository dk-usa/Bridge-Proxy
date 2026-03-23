const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    console.log('Body:', body);
    
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      const parsed = JSON.parse(body);
      
      if (parsed.stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        
        const message = 'Hello from the mock server! This is a streaming response.';
        
        res.write(`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"meta/llama-3.1-70b-instruct","choices":[{"index":0,"delta":{"role":"assistant","content":"${message}"},"finish_reason":null}]}\n\n`);
        res.write(`data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"meta/llama-3.1-70b-instruct","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'meta/llama-3.1-70b-instruct',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello from the mock server! This is a test response.'
              },
              finish_reason: 'stop',
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          }
        }));
      }
    } else {
      res.writeHead(404);
      res.end('Not found: ' + req.url);
    }
  });
});

server.listen(8888, () => {
  console.log('Mock server running on http://localhost:8888');
});
