import { getSiteInfo } from "@/services/site-info";

export default function HomePage() {
  const site = getSiteInfo();
  return (
    <main id="main">
      <h1>{site.name}</h1>
      <p>{site.tagline}</p>
      <h2>Who it is for</h2>
      <ul className="audiences">
        {site.audiences.map((audience) => (
          <li key={audience}>{audience}</li>
        ))}
      </ul>
      <p>
        This is an early scaffold. Verified politician, party, policy and bill
        information will appear here as it is published.
      </p>
    </main>
  );
}
