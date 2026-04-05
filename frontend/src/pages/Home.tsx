import { Link } from 'react-router-dom';
import { getApiBaseUrl } from '../config/apiServer';
import { ROUTES } from '../routes/paths';

export function Home() {
  const apiDocsHref = `${getApiBaseUrl()}/docs`;
  return (
    <div>
      <h1>Technical Test: API & Blockchain</h1>
      <p>
        The API section calls this repo’s <strong>backend-ts</strong> via <code>VITE_API_BASE_URL</code>. In local dev,
        use <code>/api</code> so Vite proxies to port 3000. OpenAPI contract: <code>docs/api-spec.json</code>.
      </p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li style={{ marginBottom: '0.5rem' }}>
          <Link to={ROUTES.API_DEMO}>API Demo</Link> – Paginated tasks, detail by id, create (POST), update (PATCH), delete
          with confirmation and toasts. Sign in from the header — all task API calls require a session.
        </li>
        <li style={{ marginBottom: '0.5rem' }}>
          <Link to={ROUTES.BLOCKCHAIN_DEMO}>Blockchain Demo</Link> – RainbowKit connect modal (wagmi + viem), read{' '}
          <code>balanceOf</code>, <code>transfer</code> with confirmation and explorer link.
        </li>
        <li>
          <a href={apiDocsHref} target="_blank" rel="noopener noreferrer">
            API docs
          </a>{' '}
          – Interactive Swagger UI for the Tasks API (Try it out). Start <code>backend-ts</code> or{' '}
          <code>npm run dev</code> at the repo root. Opens <code>{apiDocsHref}</code> in a new tab; raw schema:{' '}
          <code>{getApiBaseUrl()}/openapi.json</code>.
        </li>
      </ul>
    </div>
  );
}
