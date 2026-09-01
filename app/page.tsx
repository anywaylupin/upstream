import { db } from "@/db";
import { repos } from "@/db/schema";

export default async function Home() {
  const rows = await db.select().from(repos);
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id}>
          {r.owner}/{r.name}
        </li>
      ))}
    </ul>
  );
}
