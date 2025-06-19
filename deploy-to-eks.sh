#!/bin/bash
set -e

# Configuration - Replace with your values
AWS_ACCOUNT_ID="your-aws-account-id"
AWS_REGION="your-aws-region"
ECR_REPOSITORY_NAME="game-backend"
EKS_CLUSTER_NAME="your-eks-cluster-name"
IMAGE_TAG="latest"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment to AWS EKS...${NC}"

# Login to AWS ECR
echo -e "${GREEN}Logging in to Amazon ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create ECR repository if it doesn't exist
echo -e "${GREEN}Checking if ECR repository exists...${NC}"
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY_NAME --region $AWS_REGION > /dev/null 2>&1; then
  echo -e "${YELLOW}Creating ECR repository...${NC}"
  aws ecr create-repository --repository-name $ECR_REPOSITORY_NAME --region $AWS_REGION
fi

# Build Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY_NAME:$IMAGE_TAG .

# Tag image for ECR
echo -e "${GREEN}Tagging Docker image for ECR...${NC}"
docker tag $ECR_REPOSITORY_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG

# Push image to ECR
echo -e "${GREEN}Pushing Docker image to ECR...${NC}"
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG

# Update kubeconfig
echo -e "${GREEN}Updating kubeconfig for EKS cluster...${NC}"
aws eks update-kubeconfig --name $EKS_CLUSTER_NAME --region $AWS_REGION

# Apply Kubernetes manifests with variable substitution
echo -e "${GREEN}Applying Kubernetes manifests...${NC}"

# Create k8s directory if it doesn't exist
mkdir -p k8s-processed

# Process templates and replace variables
for file in k8s/*.yaml; do
  basename=$(basename $file)
  sed "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g; s/\${AWS_REGION}/$AWS_REGION/g; s/\${IMAGE_TAG}/$IMAGE_TAG/g" $file > k8s-processed/$basename
done

# Apply secrets first
kubectl apply -f k8s-processed/secrets.yaml
# Apply PVC
kubectl apply -f k8s-processed/pvc.yaml
# Apply deployment and service
kubectl apply -f k8s-processed/deployment.yaml
kubectl apply -f k8s-processed/service.yaml

# Wait for deployment to roll out
echo -e "${GREEN}Waiting for deployment to complete...${NC}"
kubectl rollout status deployment/game-backend

# Get the load balancer URL
echo -e "${GREEN}Getting service URL...${NC}"
LOAD_BALANCER=$(kubectl get service game-backend -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Your application is available at: ${YELLOW}http://$LOAD_BALANCER${NC}" 