import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            href="https://lea.playground.mcclowes.com/">
            Playground
          </Link>
        </div>
      </div>
    </header>
  );
}

const codeExample = `let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print  -- 50`;

function CodeShowcase() {
  return (
    <section className={styles.codeShowcase}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2" className={styles.codeShowcaseTitle}>
              Clean, Expressive Syntax
            </Heading>
            <p>
              Lea's pipe operator <code>/&gt;</code> makes data transformations
              readable and composable. Chain operations naturally from left to right.
            </p>
            <ul>
              <li>No nested function calls</li>
              <li>Clear data flow</li>
              <li>Immutable by default</li>
            </ul>
          </div>
          <div className="col col--6">
            <pre className={styles.codeBlock}>
              <code>{codeExample}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

const FeatureList = [
  {
    title: 'Pipe-Oriented',
    icon: '/>',
    description: (
      <>
        Write data transformations that read naturally from left to right.
        The <code>/&gt;</code> operator passes values through function chains,
        eliminating nested calls and making your code more readable.
      </>
    ),
  },
  {
    title: 'First-Class Pipelines',
    icon: '|>',
    description: (
      <>
        Pipelines are values you can store, compose, and inspect.
        Create reusable transformation chains, visualize them,
        and apply algebra operations like union and intersection.
      </>
    ),
  },
  {
    title: 'Functional by Default',
    icon: 'fn',
    description: (
      <>
        Immutable bindings with <code>let</code>, pure functions,
        and decorators like <code>#memo</code> and <code>#log</code>.
        Opt into mutability with <code>maybe</code> when you need it.
      </>
    ),
  },
  {
    title: 'Built-in Concurrency',
    icon: '\\>',
    description: (
      <>
        Async/await support, parallel pipes with <code>\&gt;</code>,
        and the <code>parallel()</code> builtin make concurrent
        operations simple and safe.
      </>
    ),
  },
  {
    title: 'Powerful Decorators',
    icon: '#',
    description: (
      <>
        Add behavior to functions with trailing decorators:
        <code>#log</code>, <code>#memo</code>, <code>#retry(3)</code>,
        <code>#timeout(1000)</code>, and more.
      </>
    ),
  },
  {
    title: 'Interactive Learning',
    icon: '>_',
    description: (
      <>
        Built-in REPL with an interactive tutorial, help system,
        and runnable examples. Type <code>.tutorial</code> to start
        learning immediately.
      </>
    ),
  },
];

function Feature({title, icon, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>
          <span style={{fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--ifm-color-primary)'}}>{icon}</span>
        </div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className={clsx('text--center', styles.sectionTitle)}>
          Why Lea?
        </Heading>
        <p className={styles.sectionSubtitle}>
          A modern language designed for clarity, composability, and developer joy.
        </p>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

const comparisonData = [
  {
    feature: 'Data transformation',
    lea: 'numbers /> filter(isEven) /> map(double)',
    javascript: 'numbers.filter(isEven).map(double)',
    python: 'list(map(double, filter(isEven, numbers)))',
  },
  {
    feature: 'Function composition',
    lea: 'let process = /> step1 /> step2 /> step3',
    javascript: 'const process = (x) => step3(step2(step1(x)))',
    python: 'process = lambda x: step3(step2(step1(x)))',
  },
  {
    feature: 'Parallel execution',
    lea: 'data \\> (fetchA, fetchB, fetchC)',
    javascript: 'await Promise.all([fetchA(data), ...])',
    python: 'await asyncio.gather(fetchA(data), ...)',
  },
  {
    feature: 'Memoization',
    lea: 'let fib = (n) -> ... #memo',
    javascript: '// Requires library or manual impl',
    python: '@functools.lru_cache',
  },
  {
    feature: 'Spread over list',
    lea: 'items />>> processItem',
    javascript: 'items.map(processItem)',
    python: '[processItem(x) for x in items]',
  },
];

function ComparisonMatrix() {
  return (
    <section className={styles.comparison}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>How Lea Compares</Heading>
        <p className={styles.sectionSubtitle}>
          See how common patterns look in Lea versus other languages.
        </p>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Lea</th>
                <th>JavaScript</th>
                <th>Python</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <tr key={idx}>
                  <td className={styles.featureCell}>{row.feature}</td>
                  <td><code>{row.lea}</code></td>
                  <td><code>{row.javascript}</code></td>
                  <td><code>{row.python}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>Quick Start</Heading>
        <p className={styles.sectionSubtitle}>
          Get up and running with Lea in seconds.
        </p>
        <div className={styles.installCommands}>
          <div className={styles.installOption}>
            <h4>Try without installing</h4>
            <pre><code>npx lea-lang hello.lea</code></pre>
          </div>
          <div className={styles.installOption}>
            <h4>Install globally</h4>
            <pre><code>npm install -g lea-lang</code></pre>
          </div>
          <div className={styles.installOption}>
            <h4>Start the REPL</h4>
            <pre><code>lea --repl</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Pipe-Oriented Functional Language`}
      description="Lea is a pipe-oriented functional programming language with first-class pipelines, built-in concurrency, and powerful decorators.">
      <HomepageHeader />
      <main>
        <CodeShowcase />
        <HomepageFeatures />
        <ComparisonMatrix />
        <QuickStart />
      </main>
    </Layout>
  );
}
