#!/bin/bash

# Integration Test Suite for MCP Monitor
# Tests real HTTP API, metrics collection, and export functionality

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 MCP Monitor Integration Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Start monitoring server in background
echo "Starting MCP Monitor server..."
node dist/cli.js server --port 3001 > /tmp/mcp-monitor-test.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "✗ FAILED - Server did not start"
  cat /tmp/mcp-monitor-test.log
  exit 1
fi

echo "✓ Server started (PID: $SERVER_PID)"
echo ""

# Test 1: Health check
echo "Test 1: Health check endpoint"
if curl -s http://localhost:3001/health | jq -e '.status == "ok"' > /dev/null 2>&1; then
  echo "✓ PASSED"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 2: Get initial metrics
echo "Test 2: GET /api/metrics returns valid JSON"
METRICS=$(curl -s http://localhost:3001/api/metrics)
if echo "$METRICS" | jq -e '.serverName' > /dev/null 2>&1; then
  echo "✓ PASSED"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 3: Initial state has zero requests
echo "Test 3: Initial metrics show zero requests"
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.totalRequests')
if [ "$TOTAL_REQUESTS" -eq 0 ]; then
  echo "✓ PASSED - Total requests: $TOTAL_REQUESTS"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Expected 0, got $TOTAL_REQUESTS"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 4: Record tool call via API
echo "Test 4: POST /api/tool-call records telemetry"
curl -s -X POST http://localhost:3001/api/tool-call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "test-tool",
    "params": {"input": "hello"},
    "status": "success",
    "duration": 123
  }' > /dev/null

sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.totalRequests')
if [ "$TOTAL_REQUESTS" -eq 1 ]; then
  echo "✓ PASSED - Tool call recorded"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Expected 1 request, got $TOTAL_REQUESTS"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 5: Tool metrics are aggregated
echo "Test 5: Tool metrics show correct data"
TOOL_NAME=$(echo "$METRICS" | jq -r '.tools[0].name')
TOOL_CALLS=$(echo "$METRICS" | jq -r '.tools[0].callCount')
if [ "$TOOL_NAME" = "test-tool" ] && [ "$TOOL_CALLS" -eq 1 ]; then
  echo "✓ PASSED - Tool metrics aggregated correctly"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Tool name: $TOOL_NAME, calls: $TOOL_CALLS"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Record multiple successful calls
echo "Test 6: Multiple successful tool calls"
for i in {1..5}; do
  curl -s -X POST http://localhost:3001/api/tool-call \
    -H "Content-Type: application/json" \
    -d "{
      \"toolName\": \"read-file\",
      \"params\": {\"path\": \"/tmp/file$i.txt\"},
      \"status\": \"success\",
      \"duration\": $((50 + i * 10))
    }" > /dev/null
done

sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.totalRequests')
if [ "$TOTAL_REQUESTS" -eq 6 ]; then
  echo "✓ PASSED - 6 total requests recorded"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Expected 6, got $TOTAL_REQUESTS"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 7: Record error and check error tracking
echo "Test 7: Error tracking"
curl -s -X POST http://localhost:3001/api/tool-call \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "failing-tool",
    "params": {},
    "status": "error",
    "error": "Test error message",
    "duration": 25
  }' > /dev/null

sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
ERROR_COUNT=$(echo "$METRICS" | jq -r '.errors | length')
if [ "$ERROR_COUNT" -ge 1 ]; then
  echo "✓ PASSED - Error tracked ($ERROR_COUNT errors)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - No errors found"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 8: Success rate calculation
echo "Test 8: Success rate calculation"
SUCCESS_RATE=$(echo "$METRICS" | jq -r '.performance.successRate')
# 6 successful + 1 failed = 85.71% success rate
if [ $(echo "$SUCCESS_RATE > 85" | bc) -eq 1 ] && [ $(echo "$SUCCESS_RATE < 87" | bc) -eq 1 ]; then
  echo "✓ PASSED - Success rate: $SUCCESS_RATE%"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Success rate: $SUCCESS_RATE% (expected ~85.71%)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 9: Performance metrics
echo "Test 9: Performance metrics calculated"
AVG_LATENCY=$(echo "$METRICS" | jq -r '.performance.avgLatency')
if [ $(echo "$AVG_LATENCY > 0" | bc) -eq 1 ]; then
  echo "✓ PASSED - Avg latency: ${AVG_LATENCY}ms"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Avg latency: $AVG_LATENCY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 10: Record resource access
echo "Test 10: Resource access tracking"
curl -s -X POST http://localhost:3001/api/resource-access \
  -H "Content-Type: application/json" \
  -d '{
    "resourceUri": "file:///test.txt",
    "operation": "read",
    "status": "success",
    "duration": 45,
    "bytesTransferred": 1024
  }' > /dev/null

sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
RESOURCE_COUNT=$(echo "$METRICS" | jq -r '.resources | length')
if [ "$RESOURCE_COUNT" -ge 1 ]; then
  echo "✓ PASSED - Resource access tracked"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - No resources found"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 11: Record prompt call
echo "Test 11: Prompt call tracking"
curl -s -X POST http://localhost:3001/api/prompt-call \
  -H "Content-Type: application/json" \
  -d '{
    "promptName": "code-review",
    "args": {"file": "test.js"},
    "status": "success",
    "duration": 350,
    "tokensGenerated": 150
  }' > /dev/null

sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
PROMPT_COUNT=$(echo "$METRICS" | jq -r '.prompts | length')
if [ "$PROMPT_COUNT" -ge 1 ]; then
  echo "✓ PASSED - Prompt call tracked"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - No prompts found"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 12: Metrics export
echo "Test 12: Metrics export to file"
curl -s http://localhost:3001/api/export -o /tmp/mcp-export-test.json
if [ -f /tmp/mcp-export-test.json ] && [ -s /tmp/mcp-export-test.json ]; then
  EXPORTED_REQUESTS=$(jq -r '.totalRequests' /tmp/mcp-export-test.json)
  echo "✓ PASSED - Exported $EXPORTED_REQUESTS requests to file"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Export file not created"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 13: CLI status command
echo "Test 13: CLI status command"
if node dist/cli.js status http://localhost:3001 --json | jq -e '.totalRequests' > /dev/null 2>&1; then
  echo "✓ PASSED - CLI status command works"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - CLI status command failed"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 14: CLI export command
echo "Test 14: CLI export command"
if node dist/cli.js export http://localhost:3001 -o /tmp/cli-export.json > /dev/null 2>&1; then
  if [ -f /tmp/cli-export.json ] && [ -s /tmp/cli-export.json ]; then
    echo "✓ PASSED - CLI export works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "✗ FAILED - Export file empty"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo "✗ FAILED - CLI export failed"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 15: Metrics reset
echo "Test 15: Metrics reset"
curl -s -X POST http://localhost:3001/api/reset > /dev/null
sleep 0.5

METRICS=$(curl -s http://localhost:3001/api/metrics)
TOTAL_AFTER_RESET=$(echo "$METRICS" | jq -r '.totalRequests')
if [ "$TOTAL_AFTER_RESET" -eq 0 ]; then
  echo "✓ PASSED - Metrics reset successfully"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "✗ FAILED - Metrics not reset (found $TOTAL_AFTER_RESET requests)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Cleanup
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
rm -f /tmp/mcp-monitor-test.log /tmp/mcp-export-test.json /tmp/cli-export.json

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Integration Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo "✓ Passed: $TESTS_PASSED"
echo "✗ Failed: $TESTS_FAILED"
PASS_RATE=$(( (TESTS_PASSED * 100) / (TESTS_PASSED + TESTS_FAILED) ))
echo "Pass Rate: $PASS_RATE%"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi
