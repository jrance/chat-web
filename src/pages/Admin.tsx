import { Link } from "react-router-dom";

function Admin(): JSX.Element {
  return (
    <section>
      <h2>Admin Dashboard</h2>
      <p>Manage application configuration and user access from here.</p>

      <nav aria-label="Admin tools">
        <ul>
          <li>
            <Link to="/admin/agent-builder">Agent Builder</Link>
          </li>
        </ul>
      </nav>
    </section>
  );
}

export default Admin;
