# Example: python-ml

A Python ML training job using S3, OpenAI, and Sentry.

```bash
fde scan examples/python-ml
fde check examples/python-ml
```

What OpenFDE shows here:

- **Scan** detects Python, AWS, OpenAI, and Sentry from `requirements.txt` /
  `train.py` with file evidence.
- **Check** passes the PII gate (external model use is explicitly declared as
  `allowExternalModel: false` — which is a conversation to have, since OpenAI
  *is* in the dependency list) and warns that **no evaluation is declared**
  for a model pipeline.
