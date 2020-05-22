import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  extractParamsFromBody,
  pullTranslations,
  pushChangesToRemote,
  createPullRequest
} from './utils';

const run = async () => {
  const { body, number, title } = github.context.payload.issue!;
  if (!title.startsWith('[TRANSLATIONS]')) {
    core.info(`Ignoring issue with title ${title}`);
    process.exit(0);
  }

  core.info(`㊗️ Pulling translations from Transifex`);
  const { project, resource, languages, mode, branch } = extractParamsFromBody(
    body!
  );
  await pullTranslations(project, resource, languages, mode, branch);
  await pushChangesToRemote(project, resource);
  await createPullRequest(project, resource, languages, mode, number, branch);
  core.info(`Done processing new translations for ${resource}`);
};

run().catch((err: Error) => {
  core.setFailed(err.message);
});
