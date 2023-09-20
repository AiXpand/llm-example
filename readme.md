Make `.env` file based on `.env.example`

Pull dependencies:
```
    npm install
```

Compile with:
```
    tsc
```

Run with:
```
    node dist/index.js
```

When running please wait for HTTP server to start. After the HTTP server is up and waiting for requests, one route should be available:

```
POST http://localhost:[APP_PORT]

Request body:
{
    "requestId": "test-1234",
    "prompt": "Hello LLM model!",
    "history": [
        {
            "prompt": "before previous prompt if any",
            "response": "before previous response if any"
        },
        {
            "prompt": "previous prompt if any",
            "response": "previous response if any"
        }
    ]
}

Response:
{
    "response": "\n    #\n    # Processing node gts-test2:aixp_A3ftIXaDm84HdpSE_KvZ9s6FJHJR7YUW5B90wLsSlh-i\n    #\n    # This is a static code example generated  for testing purposes\n    # based on request_id: test-1234 \n    #\n    \n    if __name__ == '__main__':\n\t\t\tprint(\"Hello World!\")\n    "
}
```
