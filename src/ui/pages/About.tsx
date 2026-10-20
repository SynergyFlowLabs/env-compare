import { Wordmark } from '../components/Brand';

export function About() {
  return (
    <div className="shell">
      <header className="header">
        <div className="header__inner">
          <Wordmark />
          <span className="header__spacer" />
          <nav className="header__nav" aria-label="Site">
            <a href="/">Tool</a>
            <a href="/privacy">Privacy</a>
          </nav>
        </div>
      </header>

      <main className="shell__main">
        <article className="page">
          <h1>Why this exists</h1>
          <p>
            AI code editors and agents are built not to touch <code>.env</code> files. Instead they
            write a <code>.env.example</code> describing what the project needs, and you fill in the
            real file by hand.
          </p>
          <p>
            Then the project grows. The example gains keys. Your <code>.env</code> quietly falls
            behind. Nothing warns you — the app just breaks later with a <code>401</code>, a blank
            page, or a database error, and the cause is one line missing from a file you were told
            not to worry about.
          </p>
          <p>
            A plain diff does not solve this. It compares lines, not variables, and it says nothing
            about the two failures that hurt most: a key that is present but empty, and a key that
            still holds the example value.
          </p>

          <h2>What it does differently</h2>
          <ul>
            <li>It compares variables, not text, and names six states per file.</li>
            <li>It shows the gap in both a table and the raw text.</li>
            <li>It gives you the block to paste, not just a diagnosis.</li>
            <li>It treats your values as something that must never leave the tab.</li>
          </ul>

          <h2>What it deliberately is not</h2>
          <ul>
            <li>Not a secret manager: it stores nothing and syncs nothing.</li>
            <li>Not a linter: it compares what you have against what the example asks for.</li>
            <li>Not an AI feature: no file content is ever sent to a model.</li>
          </ul>

          <h2>Open source</h2>
          <p>
            The source, the product specification and the parser test corpus are public. Issues and
            pull requests are welcome, including parser edge cases — those become permanent tests.
          </p>
        </article>
      </main>
    </div>
  );
}
