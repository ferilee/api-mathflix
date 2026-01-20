import { db } from './src/db';
import { poll_votes, posts } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
    console.log("Checking database...");
    try {
        const postsData = await db.select().from(posts).limit(1);
        console.log("Posts table exists. Count:", postsData.length);

        try {
            const votesData = await db.select().from(poll_votes).limit(1);
            console.log("Poll Votes table exists. Count:", votesData.length);
        } catch (e: any) {
            console.error("Poll Votes table ERROR:", e.message);
        }
    } catch (e: any) {
        console.error("Posts table ERROR:", e.message);
    }
}

check();
