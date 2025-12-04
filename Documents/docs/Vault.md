# Vault - Secrets Structure Reference

> **⚠️ SECURITY WARNING:** This file documents the STRUCTURE of secrets management only.  
> **NEVER OUTPUT ACTUAL SECRET VALUES OR CREDENTIALS.**

---

## Purpose
This document serves as a reference for understanding how secrets and sensitive configuration are managed in the project. It does NOT contain actual secrets.

---

## Secret Categories

### 1. Database Credentials
**Structure:**
```
DB_HOST=postgresql://host:port
DB_NAME=database_name
DB_USER=username
DB_PASSWORD=password
DB_SSL=true/false
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Rotation:** Manual (update environment variables)

---

### 2. Redis Credentials
**Structure:**
```
REDIS_HOST=redis://host:port
REDIS_PASSWORD=password (if required)
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Rotation:** Manual

---

### 3. Authentication Secrets
**Structure:**
```
SESSION_SECRET=random_secret_string
JWT_SECRET=random_secret_string (if used)
GOOGLE_CLIENT_ID=oauth_client_id
GOOGLE_CLIENT_SECRET=oauth_client_secret
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Rotation:** 
- Session secret: Rotate periodically (invalidates sessions)
- OAuth secrets: Rotate via Google Cloud Console

---

### 4. Email Service (SendGrid)
**Structure:**
```
SENDGRID_API_KEY=api_key_string
SMTP_HOST=smtp.sendgrid.net (or alternative)
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=api_key_string
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Rotation:** Via SendGrid dashboard

---

### 5. Cloud Storage (GCP)
**Structure:**
```
GCP_PROJECT_ID=project_id
GCP_STORAGE_BUCKET=bucket_name
GCP_SERVICE_ACCOUNT_KEY=json_key_content (or path)
```

**Storage:** 
- Environment variables (for simple config)
- Service account JSON file (for complex auth)
- Google Cloud Secret Manager (recommended for production)

**Access:** Server-side only  
**Rotation:** Via Google Cloud Console

---

### 6. AI Service APIs
**Structure:**
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Rotation:** Via respective API dashboards

---

### 7. Exchange Rate API
**Structure:**
```
ECB_API_URL=https://api.exchangerate.host (or similar)
ECB_API_KEY=optional_key (if required)
```

**Storage:** Environment variables  
**Access:** Server-side only  
**Note:** ECB API is typically free and doesn't require API key

---

## Secret Management Strategy

### Development Environment
- Use `.env` files (gitignored)
- Store in local development environment
- Never commit to version control

### Production Environment
- **Recommended:** Google Cloud Secret Manager
- **Alternative:** Environment variables in deployment platform
- **Never:** Hardcoded secrets in code
- **Never:** Commit secrets to version control

---

## Secret Rotation Policy

### High Priority (Rotate Regularly)
- Session secrets (every 90 days)
- API keys with write access (every 180 days)

### Medium Priority (Rotate Periodically)
- Database passwords (every 180 days)
- OAuth client secrets (every 365 days)

### Low Priority (Rotate on Compromise)
- Read-only API keys
- Public configuration values

---

## Secret Validation

### Required Secrets (Application won't start without)
- `SESSION_SECRET`
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`

### Optional Secrets (Features degrade without)
- `SENDGRID_API_KEY` (email features disabled)
- `OPENAI_API_KEY` / `GEMINI_API_KEY` (AI Assistant disabled)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google OAuth disabled)

---

## Security Best Practices

1. **Never log secrets:** Ensure logging doesn't output secret values
2. **Use environment validation:** Validate required secrets on startup
3. **Principle of least privilege:** Use minimal permissions for service accounts
4. **Audit access:** Log access to secrets (via Secret Manager audit logs)
5. **Encryption at rest:** Ensure secrets are encrypted in storage
6. **Encryption in transit:** Use HTTPS/TLS for all API communications

---

## Secret Manager Integration (Future)

### Google Cloud Secret Manager
**Structure:**
```
secrets/
  ├── db-password
  ├── session-secret
  ├── sendgrid-api-key
  ├── openai-api-key
  └── gcp-service-account-key
```

**Access Pattern:**
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: 'projects/PROJECT_ID/secrets/SECRET_NAME/versions/latest',
});
const secretValue = version.payload.data.toString();
```

**Benefits:**
- Automatic rotation support
- Versioning
- Audit logging
- IAM-based access control

---

## Environment Variable Reference

### Complete List (Reference Only - No Values)

```bash
# Database
DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_SSL=

# Redis
REDIS_HOST=
REDIS_PASSWORD=

# Authentication
SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
SENDGRID_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# Cloud Storage
GCP_PROJECT_ID=
GCP_STORAGE_BUCKET=
GCP_SERVICE_ACCOUNT_KEY=

# AI Services
OPENAI_API_KEY=
GEMINI_API_KEY=

# Exchange Rates
ECB_API_URL=

# Application
NODE_ENV=development|production
PORT=3000
FRONTEND_URL=http://localhost:5173
```

---

## Emergency Procedures

### If Secrets Are Compromised
1. **Immediately rotate** all affected secrets
2. **Revoke** compromised API keys/tokens
3. **Audit** access logs for unauthorized usage
4. **Notify** affected users if user data is at risk
5. **Document** incident in security log

### Secret Recovery
- **Development:** Restore from secure backup or regenerate
- **Production:** Use Secret Manager version history or regenerate

---

## Compliance Notes

- Secrets must comply with organizational security policies
- Regular security audits required
- Access logs must be retained per compliance requirements
- Encryption standards must meet industry requirements (AES-256, TLS 1.2+)

---

## References

- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)

---
**Last Updated:** 2025-01-03  
**Maintainer:** Technical Lead  
**Security Review:** Quarterly  
**⚠️ NEVER OUTPUT ACTUAL SECRET VALUES**

