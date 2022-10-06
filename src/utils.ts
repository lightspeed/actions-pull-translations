import _ from 'lodash';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { command } from 'execa';
import { readFile } from 'fs';
import { render } from 'mustache';
import { inspect, promisify } from 'util';

const readFileAsync = promisify(readFile);

export type InputMode =
    'default'
    | 'reviewed'
    | 'proofread'
    | 'translator'
    | 'untranslated'
    | 'onlytranslated'
    | 'onlyreviewed'
    | 'onlyproofread'
    | 'sourceastranslation';

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
 * Pull Translations from Transifex via the CLI
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 * @param languages The languages to pull, i.e.: ['fr', 'de']
 * @param mode The translation mode of the downloaded file. This can be one of the following:
 * 'default', 'reviewed', 'proofread', 'translator', 'untranslated',
 * 'onlytranslated', 'onlyreviewed', "'onlyproofread', 'sourceastranslation'
 * @param branch Base branch to pull changes from reading the correct .tx/config
 */
export const pullTranslations = async (
  project: string,
  resource: string,
  languages: string[],
  mode: InputMode,
  branch: string
) => {
  core.info(`Pulling translations from Transifex`);
  const fullResource = `${project}.${resource}`;

  if (branch) {
    await runShellCommand(`git fetch`);
    await runShellCommand(`git checkout ${branch}`);
  }

  await runShellCommand(
    `tx pull --mode ${mode} -f -l ${languages.join(
      ','
    )} -r ${fullResource}`
  );
};

/**
 * Creates a branch, makes a commit, and pushes the changes to the remote
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 */
export const pushChangesToRemote = async (
  project: string,
  resource: string
) => {
  core.info(`Pushing changes to remote`);
  const fullResource = `${project}.${resource}`;

  await runShellCommand(`git config --global user.name "GitHub Action"`);
  await runShellCommand(`git config --global user.email "action@github.com"`);
  await runShellCommand('git add .');
  await runShellCommand(
    `git commit -m "Auto-committed translation changes for ${fullResource}"`
  );
  await runShellCommand(`git checkout -b feature/translations/${fullResource}`);
  await runShellCommand(
    `git push -f https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git HEAD:refs/heads/feature/translations/${fullResource}`
  );
};

/**
 * Creates a pull request to the master branch
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 * @param languages The languages to pull, i.e.: ['fr', 'de']
 * @param mode The translation mode of the downloaded file. This can be one of the following:
 * 'default', 'reviewed', 'proofread', 'translator', 'untranslated',
 * 'onlytranslated', 'onlyreviewed', "'onlyproofread', 'sourceastranslation'
 * @param branch The base branch to create the PR
 */
export const createPullRequest = async (
  project: string,
  resource: string,
  languages: string[],
  mode: InputMode,
  branch: string = 'master'
) => {
  core.info(`Creating pull request to ${branch}`);
  const fullResource = `${project}.${resource}`;

  const template = await readFileAsync(__dirname + '/../template.md', 'utf8');
  const title = `[TRANSLATIONS] Pull translations for ${resource}`;
  const body = render(template, {
    project,
    resource,
    languages,
    mode,
    branch,
  });
  const head = `feature/translations/${fullResource}`;
  const base = branch;

  const token = process.env.GITHUB_TOKEN!;
  const octokit = github.getOctokit(token);

  try {
    const response = await octokit.rest.pulls.create({
      ...github.context.repo,
      head,
      base,
      title,
      body
    });
    return response.data.number;
  } catch (err) {
    core.info(`Failed to create PR: ${err.message}`);
  }
};

/**
 * Add the workflow actor as assignee to the PR
 * @param pullRequest The pull request number
 * @param addPullerAsAssignee Whether to add the workflow actor as assignee
 */
export const addAssignee = async (
    pullRequest: number,
    addPullerAsAssignee: boolean
) => {
  if (!addPullerAsAssignee) { return; }

  const token = process.env.GITHUB_TOKEN!;
  const octokit = github.getOctokit(token);

  try {
    await octokit.rest.issues.addAssignees({
      ...github.context.repo,
      issue_number: pullRequest,
      assignees: [github.context.actor]
    });
  } catch (err) {
    core.info(`Failed to add assignees: ${err.message}`);
  }
};

/**
 * Add the workflow actor as reviewer to the PR
 * @param pullRequest The pull request number
 * @param addPullerAsReviewer Whether to add the workflow actor as reviewer
 */
export const requestReviewer = async (
    pullRequest: number,
    addPullerAsReviewer: boolean
) => {
  if (!addPullerAsReviewer) { return; }

  const token = process.env.GITHUB_TOKEN!;
  const octokit = github.getOctokit(token);

  try {
    await octokit.rest.pulls.requestReviewers({
      ...github.context.repo,
      pull_number: pullRequest,
      reviewers: [github.context.actor]
    });
  } catch (err) {
    core.info(`Failed to request reviewers: ${err.message}`);
  }
};
