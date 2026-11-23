/**
 * MiniBank HTTP Server
 * 
 * Standalone, lightweight originating loan server.
 * Evaluates underwriting rules and streams audit events to DecisionTrace.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.ts';
import { evaluateLoanRules } from './rules/underwriting.ts';
import type { LoanApplication } from './rules/underwriting.ts';
import { dispatchLoanEvents } from './services/decisiontrace-client.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Serve Loan Application UI
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading MiniBank application page: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  // 2. Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'minibank', port: config.port }));
    return;
  }

  // 3. POST /api/apply - Evaluate Loan & Publish to DecisionTrace
  if (req.method === 'POST' && req.url === '/api/apply') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });

    req.on('end', async () => {
      try {
        const appInput = JSON.parse(body) as LoanApplication;

        // Basic validation
        if (
          !appInput.applicantName ||
          typeof appInput.monthlyIncome !== 'number' ||
          typeof appInput.requestedAmount !== 'number'
        ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid loan application parameters.' }));
          return;
        }

        // 1. Evaluate Rule-based Underwriting Logic
        const decision = evaluateLoanRules(appInput);
        console.log(`[MiniBank] Application for ${appInput.applicantName} -> Outcome: ${decision.outcome} (Risk Score: ${decision.riskScore})`);

        // 2. Dispatch Cryptographic Events to DecisionTrace
        const audit = await dispatchLoanEvents(appInput, decision);
        console.log(`[MiniBank] Events ingested into DecisionTrace case: ${audit.caseId} (Latest Hash: ${audit.latestEventHash.slice(0, 16)}...)`);

        // 3. Return outcome and flight recorder link
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            decision,
            audit,
          })
        );
      } catch (err: any) {
        console.error('[MiniBank] Loan processing error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: err.message || 'Internal MiniBank error occurred while communicating with DecisionTrace.',
          })
        );
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🏦 MiniBank Loan App running at: http://localhost:${config.port}`);
  console.log(`🔗 Linked to DecisionTrace API:  ${config.decisionTraceApiUrl}`);
  console.log(`=======================================================`);
});
