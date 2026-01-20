
import { db } from './src/db';
import { posts } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const targetId = '0ee238d7-c919-49e4-87a0-95cda10b7310';
    console.log(`Checking for post: ${targetId}`);

    const post = await db.query.posts.findFirst({
        where: eq(posts.id, targetId)
    });

    if (post) {
        console.log("✅ Post FOUND!");
        console.log("Title/Content:", post.content);
        console.log("Poll Options:", post.poll_options);
    } else {
        console.log("❌ Post NOT FOUND in database.");

        // List all IDs to see if there's a mismatch or if DB is empty
        const allPosts = await db.query.posts.findMany({
            columns: { id: true, content: true }
        });
        console.log(`\nTotal Posts in DB: ${allPosts.length}`);
        allPosts.forEach(p => console.log(`- ${p.id}: ${p.content.substring(0, 20)}...`));
    }
}

main().catch(console.error);
