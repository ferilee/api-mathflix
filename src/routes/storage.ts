import { Hono } from "hono";
import {
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { bucketName, s3Client } from "../lib/s3";

const storage = new Hono();

storage.get("/health", async (c) => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return c.json({ ok: true, status: "reachable" });
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (error?.name === "NotFound" || status === 404) {
      return c.json({ ok: false, status: "missing_bucket" }, 503);
    }
    console.error("Storage health error:", error);
    return c.json({ ok: false, status: "unreachable" }, 503);
  }
});

storage.get("/list", async (c) => {
  try {
    const prefix = c.req.query("prefix") || "";
    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 200,
      }),
    );

    const items = (result.Contents || [])
      .map((item) => ({
        key: item.Key || "",
        size: item.Size || 0,
        last_modified: item.LastModified
          ? item.LastModified.toISOString()
          : null,
        url: item.Key ? `/storage/${item.Key}` : "",
      }))
      .filter((item) => item.key);

    return c.json({ items });
  } catch (error: any) {
    console.error("Storage list error:", error);
    return c.json({ error: "Failed to list storage files" }, 500);
  }
});

storage.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.json({ error: "Missing storage key" }, 400);
  }

  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key }),
    );
    if (!result.Body) {
      return c.json({ error: "File not found" }, 404);
    }

    let body: BodyInit;
    const rawBody = result.Body as any;
    if (typeof rawBody.transformToWebStream === "function") {
      body = rawBody.transformToWebStream();
    } else if (rawBody instanceof ReadableStream) {
      body = rawBody;
    } else if (rawBody instanceof Readable) {
      body = Readable.toWeb(rawBody);
    } else {
      body = rawBody as BodyInit;
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      result.ContentType || "application/octet-stream",
    );
    if (typeof result.ContentLength === "number") {
      headers.set("Content-Length", result.ContentLength.toString());
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(body, { status: 200, headers });
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (error?.name === "NoSuchKey" || status === 404) {
      return c.json({ error: "File not found" }, 404);
    }
    console.error("Storage fetch error:", error);
    return c.json({ error: "Failed to load file from storage" }, 500);
  }
});

export default storage;
