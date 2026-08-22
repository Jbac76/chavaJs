# Kubernetes Deployment Guide for chavaJs

This directory contains Kubernetes manifests for deploying chavaJs to a Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Docker registry for your images
- Ingress controller (nginx recommended)
- cert-manager for TLS certificates (optional)
- PostgreSQL database
- Redis instance

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t your-registry/chavajs:latest .

# Push to registry
docker push your-registry/chavajs:latest
```

### 2. Create Secrets

Create the required secrets:

```bash
kubectl create secret generic chavajs-secrets \
  --from-literal=app-key="$(openssl rand -base64 32)" \
  --from-literal=db-username='your-db-user' \
  --from-literal=db-password='your-db-password' \
  --from-literal=redis-password='your-redis-password'
```

### 3. Deploy the Application

```bash
# Deploy the main application
kubectl apply -f deployment.yaml

# Deploy queue workers
kubectl apply -f queue-worker.yaml

# Set up ingress
kubectl apply -f ingress.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=chavajs

# Check logs
kubectl logs -l app=chavajs --tail=100 -f

# Check service
kubectl get service chavajs-service

# Test health endpoint
kubectl port-forward service/chavajs-service 8080:80
curl http://localhost:8080/health
```

## Architecture

```
┌─────────────┐
│   Ingress   │  (TLS termination, routing)
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│  chavajs-service (ClusterIP) │
└──────┬──────────────────────┘
       │
┌──────▼─────────────────┐
│  App Pods (3 replicas) │  (Horizontal scaling)
└────────────────────────┘

┌────────────────────────┐
│ Queue Worker Pods (2)  │  (Background jobs)
└────────────────────────┘

┌────────────┐  ┌─────────┐
│ PostgreSQL │  │  Redis  │  (Stateful services)
└────────────┘  └─────────┘
```

## Configuration

### Environment Variables

Edit `deployment.yaml` to configure:

- `APP_ENV`: Environment (production/staging)
- `APP_DEBUG`: Debug mode (true/false)
- `DB_*`: Database connection settings
- `REDIS_*`: Redis connection settings
- `QUEUE_CONNECTION`: Queue driver (redis/database)

### Resource Limits

Adjust resource requests/limits in `deployment.yaml`:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Horizontal Pod Autoscaling

Create HPA based on CPU/memory:

```bash
kubectl autoscale deployment chavajs-app \
  --cpu-percent=70 \
  --min=3 \
  --max=10
```

Or use custom metrics with HPA v2:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chavajs-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chavajs-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Health Checks

### Liveness Probe
- Endpoint: `/health`
- Checks if the application is running
- Kubernetes will restart the pod if this fails

### Readiness Probe
- Endpoint: `/health/ready`
- Checks if the application can accept traffic
- Includes database connectivity check
- Pod is removed from service if this fails

## Database Setup

### Using Cloud-Managed Database

For production, use a managed database service:
- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL

Update `deployment.yaml` with connection details.

### Running PostgreSQL in Kubernetes

```bash
# Deploy PostgreSQL
kubectl apply -f postgres.yaml

# Create database
kubectl exec -it postgres-0 -- psql -U postgres -c "CREATE DATABASE chava_production;"
```

## Storage

### Persistent Storage

The application uses a PersistentVolumeClaim for:
- Session files
- Uploaded files
- Logs

Adjust storage size in `deployment.yaml`:

```yaml
resources:
  requests:
    storage: 5Gi  # Change as needed
```

### Storage Class

Use appropriate storage class for your environment:
- `standard`: General purpose
- `fast-ssd`: High IOPS for databases
- `regional-pd`: Multi-zone replication

## TLS/SSL

### Using cert-manager

1. Install cert-manager:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

2. Create Let's Encrypt issuer:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

3. Apply:
```bash
kubectl apply -f letsencrypt-issuer.yaml
```

Certificates will be automatically provisioned and renewed.

## Monitoring

### Logs

View application logs:

```bash
# Real-time logs
kubectl logs -f deployment/chavajs-app

# Logs from all replicas
kubectl logs -l app=chavajs --all-containers=true -f

# Previous container logs (if crashed)
kubectl logs deployment/chavajs-app --previous
```

### Metrics

Expose metrics for Prometheus:

```bash
# Port-forward to view metrics
kubectl port-forward service/chavajs-service 8080:80
curl http://localhost:8080/metrics
```

## Scaling

### Manual Scaling

```bash
# Scale application pods
kubectl scale deployment chavajs-app --replicas=5

# Scale queue workers
kubectl scale deployment chavajs-queue-worker --replicas=3
```

### Vertical Pod Autoscaling

Install VPA:

```bash
kubectl apply -f https://github.com/kubernetes/autoscaler/releases/download/vertical-pod-autoscaler-0.13.0/vpa-v0.13.0.yaml
```

## Troubleshooting

### Pod Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Get shell access
kubectl exec -it <pod-name> -- sh
```

### Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -it <pod-name> -- sh
# Inside pod:
apt-get update && apt-get install -y postgresql-client
psql -h postgres-service -U chava -d chava_production
```

### Memory/CPU Issues

```bash
# Check resource usage
kubectl top pods -l app=chavajs

# Check resource requests vs usage
kubectl describe node <node-name>
```

## Backup and Disaster Recovery

### Database Backups

Set up automated backups for your database:

```bash
# Example: PostgreSQL backup using CronJob
kubectl apply -f backup-cronjob.yaml
```

### Storage Backups

Use volume snapshots or backup solutions like:
- Velero
- Cloud provider backup services

## Rolling Updates

### Zero-Downtime Deployment

```bash
# Update image
kubectl set image deployment/chavajs-app app=your-registry/chavajs:v1.1.0

# Check rollout status
kubectl rollout status deployment/chavajs-app

# Rollback if needed
kubectl rollout undo deployment/chavajs-app
```

### Blue-Green Deployment

1. Create new deployment with different selector
2. Test new version
3. Update service selector to new deployment
4. Remove old deployment

## Security Best Practices

1. **Use secrets management**
   - HashiCorp Vault
   - Sealed Secrets
   - External Secrets Operator

2. **Network policies**
   - Restrict pod-to-pod communication
   - Allow only necessary traffic

3. **RBAC**
   - Limit service account permissions
   - Use separate accounts for different components

4. **Pod Security Standards**
   - Run as non-root user
   - Read-only root filesystem
   - No privilege escalation

5. **Image security**
   - Scan images for vulnerabilities
   - Use minimal base images
   - Sign images

## Cost Optimization

1. **Right-size resources**
   - Use VPA for recommendations
   - Monitor actual usage

2. **Use spot instances**
   - For non-critical workers
   - With proper pod disruption budgets

3. **Cluster autoscaling**
   - Scale nodes based on demand

4. **Resource quotas**
   - Prevent resource hogging

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
