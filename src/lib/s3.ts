import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.MINIO_ENDPOINT || "localhost";
const port = process.env.MINIO_PORT || "9000";
const accessKeyId = process.env.MINIO_ACCESS_KEY || "admin";
const secretAccessKey = process.env.MINIO_SECRET_KEY || "password123";
const useSSL = process.env.MINIO_USE_SSL === "true";

export const s3Client = new S3Client({
    endpoint: `http${useSSL ? "s" : ""}://${endpoint}:${port}`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
    region: "us-east-1", // MinIO doesn't care about region but SDK requires it
    forcePathStyle: true, // Required for MinIO
});

export const bucketName = process.env.MINIO_BUCKET || "mathflix";

// Ensure bucket exists
export const ensureBucket = async () => {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            console.log(`Creating bucket: ${bucketName}`);
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));

            // Set public read policy for the bucket (MinIO specific)
            // Note: This can also be done via MinIO console easily.
        } else {
            throw error;
        }
    }
};
