# AWS EKS Deployment Guide

This guide provides instructions for deploying the game backend to AWS Elastic Kubernetes Service (EKS).

## Prerequisites

1. AWS CLI installed and configured with appropriate permissions
2. Docker installed locally
3. kubectl installed
4. eksctl installed
5. An existing EKS cluster or permission to create one

## Creating an EKS Cluster

1. Review and modify the `eks-cluster.yaml` file according to your requirements:
   ```bash
   eksctl create cluster -f eks-cluster.yaml
   ```

2. This process will take approximately 15-20 minutes to complete.

3. Once the cluster is created, verify it's working:
   ```bash
   kubectl get nodes
   ```

## Setting up Amazon EFS for Persistent Storage

1. Create an EFS file system in the same VPC as your EKS cluster:
   ```bash
   # Get VPC ID
   VPC_ID=$(aws eks describe-cluster --name game-backend-cluster --query "cluster.resourcesVpcConfig.vpcId" --output text)
   
   # Create security group for EFS
   SG_ID=$(aws ec2 create-security-group --group-name EFS-for-Game-Backend --description "EFS for Game Backend" --vpc-id $VPC_ID --output text --query 'GroupId')
   
   # Allow NFS traffic from within the VPC
   aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 2049 --cidr 10.0.0.0/16
   
   # Create EFS file system
   EFS_ID=$(aws efs create-file-system --performance-mode generalPurpose --throughput-mode bursting --encrypted --tags Key=Name,Value=game-backend-efs --output text --query 'FileSystemId')
   
   # Get subnet IDs
   SUBNET_IDS=$(aws eks describe-cluster --name game-backend-cluster --query "cluster.resourcesVpcConfig.subnetIds" --output text)
   
   # Create mount targets in all subnets
   for SUBNET in $SUBNET_IDS; do
     aws efs create-mount-target --file-system-id $EFS_ID --subnet-id $SUBNET --security-groups $SG_ID
   done
   
   # Update the storage class config with the EFS ID
   sed -i "s/\${EFS_FILE_SYSTEM_ID}/$EFS_ID/g" k8s/efs-storage-class.yaml
   ```

2. Create the EFS storage class in Kubernetes:
   ```bash
   kubectl apply -f k8s/efs-storage-class.yaml
   ```

## Environment Setup

1. Configure your AWS credentials if not already done:
   ```bash
   aws configure
   ```

2. Verify connection to your EKS cluster:
   ```bash
   aws eks update-kubeconfig --name game-backend-cluster --region YOUR_AWS_REGION
   kubectl get nodes
   ```

3. Prepare environment variables:
   - Create a `.env` file based on the `.env.example` provided
   - For EKS deployment, ensure your MongoDB and Redis are properly configured

## MongoDB and Redis Setup

You can either use Amazon DocumentDB (MongoDB-compatible) and Amazon ElastiCache (Redis), or deploy MongoDB and Redis within your Kubernetes cluster:

### Option 1: Deploy in Kubernetes (Development/Testing)

1. Apply the MongoDB and Redis configuration:
   ```bash
   kubectl apply -f k8s/mongodb-redis.yaml
   ```

2. Update the secrets to use the internal services:
   ```bash
   # Edit k8s/secrets.yaml and set:
   # mongodb-uri: "mongodb://mongodb-service:27017/game-db"
   # redis-url: "redis://redis-service:6379"
   ```

### Option 2: Use AWS Managed Services (Production Recommended)

1. Create an Amazon DocumentDB cluster and Amazon ElastiCache for Redis
2. Update the secrets to use these managed services

## Docker Image Preparation

The Dockerfile is already prepared for deployment with:
- Multi-stage build for optimal image size
- Non-root user for enhanced security
- Health check endpoints
- Python dependencies for DevOps utilities

You can build the Docker image locally to test:
```bash
docker build -t game-backend:latest .
docker run -p 3000:3000 --env-file .env game-backend:latest
```

## Deploying to AWS EKS

1. Update configuration in `deploy-to-eks.sh`:
   - Set your AWS account ID
   - Set your AWS region
   - Set your EKS cluster name

2. Make the deployment script executable:
   ```bash
   chmod +x deploy-to-eks.sh
   ```

3. Run the deployment script:
   ```bash
   ./deploy-to-eks.sh
   ```

This will:
- Build and push the Docker image to Amazon ECR
- Deploy the application to your EKS cluster
- Set up load balancing
- Configure persistent storage for uploads

## Kubernetes Resources

The following Kubernetes resources will be created:

1. **Deployment**: Manages application pods with rolling updates
2. **Service**: Exposes the application using an AWS Network Load Balancer
3. **PersistentVolumeClaim**: Provides persistent storage for uploads
4. **Secret**: Stores sensitive configuration values
5. **StatefulSets** (optional): For MongoDB and Redis if using in-cluster databases

## Customizing the Deployment

1. **Scaling**:
   Modify the replicas count in `k8s/deployment.yaml` to scale the application.

2. **Resource Limits**:
   Adjust CPU and memory limits in `k8s/deployment.yaml` based on application needs.

3. **Environment Variables**:
   Update environment variables in `k8s/secrets.yaml` for different environments.

## Accessing External Services

The application uses:
1. **MongoDB**: Configure `mongodb-uri` in secrets.yaml to point to your MongoDB instance
2. **Redis**: Configure `redis-url` in secrets.yaml to point to your Redis instance
3. **AWS GameLift**: Set GameLift credentials in secrets.yaml
4. **Firebase**: Set Firebase credentials in secrets.yaml

## Monitoring and Maintenance

- **Health checks**: The application exposes a `/api/health` endpoint for Kubernetes liveness and readiness probes
- **Logs**: Use CloudWatch for log collection and analysis
- **Metrics**: Set up Prometheus and Grafana for monitoring

## Cleaning Up

To delete all resources when no longer needed:

1. Delete application resources:
   ```bash
   kubectl delete -f k8s/
   ```

2. Delete the EKS cluster:
   ```bash
   eksctl delete cluster -f eks-cluster.yaml
   ```

3. Delete the EFS file system:
   ```bash
   # Get the mount targets and delete them first
   MOUNT_TARGETS=$(aws efs describe-mount-targets --file-system-id $EFS_ID --query 'MountTargets[*].MountTargetId' --output text)
   
   for MT in $MOUNT_TARGETS; do
     aws efs delete-mount-target --mount-target-id $MT
   done
   
   # Delete the file system
   aws efs delete-file-system --file-system-id $EFS_ID
   ``` 