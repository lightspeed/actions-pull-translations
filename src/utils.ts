import _ from 'lodash';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { command } from 'execa';
import { readFile } from 'fs';
import { render } from 'mustache';
import { inspect, promisify } from 'util';

const readFileAsync = promisify(readFile);

/**
 * Runs a shell command and dumps the output to the GitHub Actions log
 * @param commandString The command to run
 */
const runShellCommand = async (commandString: string) => {
  core.info(`$ ${commandString}`);
  try {
    const { stdout, stderr } = await command(commandString, { shell: true });
    const output = [stdout, stderr].filter(Boolean).join('\n');
    core.info(output);
    return output;
  } catch (error) {
    core.info(inspect(error));
    throw error;
  }
};

/**
 * Extract translation parameters from the issue body
 * @param body The issue body
 */
export const extractParamsFromBody = (body: string) => {
  core.info(`Extracting parameters from issue body`);
  const lines = body.split('\r\n');
  const [, , ...paramLines] = lines.filter(line =>
    line.match(/^\|\s*(.*?)(?=\s*\|)\s*\|\s*(.*?)(?=\s*\|)\s*\|/g),
  );

  const rawParams = Object.fromEntries(
    paramLines.map(line => {
      const match = /^\|\s*(.*?)(?=\s*\|)\s*\|\s*(.*?)(?=\s*\|)\s*\|/g.exec(line)!;
      return [match[1], match[2]];
    }),
  ) as {
    Project: string;
    Resource: string;
    Languages: string;
  };

  return {
    project: rawParams.Project,
    resource: rawParams.Resource,
    languages: rawParams.Languages.split(','),
  };
};

/**
 * Pull Translations from Transifex via the CLI
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 * @param languages The languages to pull, i.e.: ['fr', 'de']
 */
export const pullTranslations = async (
  project: string,
  resource: string,
  languages: string[],
) => {
  core.info(`Pulling translations from Transifex`);
  const fullResource = `${project}.${resource}`;

  await runShellCommand(`tx pull --mode reviewed -f -l ${languages.join(',')} -r ${fullResource}`);
};

/**
 * Creates a branch, makes a commit, and pushes the changes to the remote
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 */
export const pushChangesToRemote = async (project: string, resource: string) => {
  core.info(`Pushing changes to remote`);
  const fullResource = `${project}.${resource}`;

  await runShellCommand(`git config --global user.name "GitHub Action"`);
  await runShellCommand(`git config --global user.email "action@github.com"`);
  await runShellCommand('git add .');
  await runShellCommand(`git commit -m "Auto-committed translation changes for ${fullResource}"`);
  await runShellCommand(`git checkout -b feature/translations/${fullResource}`);
  await runShellCommand(
    `git push -f https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git HEAD:refs/heads/feature/translations/${fullResource}`,
  );
};

/**
 * Creates a pull request to the master branch
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 * @param languages The languages to pull, i.e.: ['fr', 'de']
 * @param issueNumber The issue number that triggered this pull
 */
export const createPullRequest = async (
  project: string,
  resource: string,
  languages: string[],
  issueNo: number,
) => {
  core.info(`Creating pull request to master`);
  const fullResource = `${project}.${resource}`;

  const template = await readFileAsync(__dirname + '/../template.md', 'utf8');
  const title = `[TRANSLATIONS] Pull translations for ${resource}`;
  const body = render(template, { project, resource, languages, issueNo });
  const head = `feature/translations/${fullResource}`;
  const base = 'master';

  const token = process.env.GITHUB_TOKEN!;
  const octokit = new github.GitHub(token);

  try {
    await octokit.pulls.create({ ...github.context.repo, head, base, title, body });
  } catch (err) {
    core.info(`Failed to create PR: ${err.message}`);
  }
};
