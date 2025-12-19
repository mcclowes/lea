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
            href="https://lea.mcclowes.com/"
            style={{marginLeft: '1rem'}}>
            Try Online
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
            <Heading as="h2">Clean, Expressive Syntax</Heading>
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
    description: (
      <>
        Built-in REPL with an interactive tutorial, help system,
        and runnable examples. Type <code>.tutorial</code> to start
        learning immediately.
      </>
    ),
  },
];

function Feature({title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          Why Lea?
        </Heading>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <Heading as="h2" className="text--center">Quick Start</Heading>
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
        <QuickStart />
      </main>
    </Layout>
  );
}
