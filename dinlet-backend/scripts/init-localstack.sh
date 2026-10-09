#!/bin/bash

echo "Waiting for LocalStack to be ready..."
sleep 5

echo "Creating S3 bucket: dinlet-bucket"
awslocal s3api create-bucket --bucket dinlet-bucket

echo "Applying CORS policy (dev: allow all origins for PUT/GET/HEAD)"
awslocal s3api put-bucket-cors --bucket dinlet-bucket --cors-configuration '{
  "CORSRules": [
    {
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": ["*"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "Listing buckets:"
awslocal s3 ls

echo "LocalStack initialization complete!"
