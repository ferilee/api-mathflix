import { Hono } from "hono";
import { s3Client, bucketName } from "../lib/s3";
import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

const upload = new Hono();

// Upload endpoint
upload.post("/", async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body["file"];

        if (!file || !(file instanceof File)) {
            return c.json({ error: "No file uploaded" }, 400);
        }

        // Validate file type
        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ];
        if (!allowedTypes.includes(file.type)) {
            return c.json({ error: "Invalid file type. Only images are allowed." }, 400);
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return c.json({ error: "File too large. Maximum size is 5MB." }, 400);
        }

        // Generate unique filename
        const ext = file.name.split(".").pop();
        const filename = `${crypto.randomUUID()}.${ext}`;

        // Prepare file data
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to MinIO
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: buffer,
            ContentType: file.type,
        }));

        // Return URL (Using storage prefix)
        // VITE_STORAGE_URL in frontend handles the base path
        const url = `/storage/${filename}`;
        return c.json({ url, filename });
    } catch (error) {
        console.error("Upload error:", error);
        return c.json({ error: "Failed to upload file to storage" }, 500);
    }
});


// List uploaded files in MinIO
upload.get("/list", async (c) => {
    try {
        const prefix = c.req.query("prefix") || "";
        const result = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            MaxKeys: 200,
        }));

        const items = (result.Contents || [])
            .map((item) => ({
                key: item.Key || "",
                size: item.Size || 0,
                last_modified: item.LastModified ? item.LastModified.toISOString() : null,
                url: item.Key ? `/storage/${item.Key}` : "",
            }))
            .filter((item) => item.key);

        return c.json({ items });
    } catch (error: any) {
        console.error("List storage error:", error);
        return c.json({ error: "Failed to list storage files" }, 500);
    }
});

export default upload;
