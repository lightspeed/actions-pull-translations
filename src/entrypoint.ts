import * as core from '@actions/core';
import {
  pullTranslations,
  pushChangesToRemote,
  createPullRequest,
  InputMode,
} from './utils';

const run = async () => {
  core.info(`㊗️ Pulling translations from Transifex`);
  const project = core.getInput('project', { required: true });
  const resource = core.getInput('resource', { required: true });
  const languages = core.getInput('languages', { required: true }).split(',');
  const mode: InputMode = core.getInput('mode', { required: true }) as InputMode;
  const branch = core.getInput('branch', { required: true });

  await pullTranslations(project, resource, languages, mode, branch);
  await pushChangesToRemote(project, resource);
  await createPullRequest(project, resource, languages, mode, branch);
  core.info(`Done processing new translations for ${resource}`);
};

run().catch((err: Error) => {
  core.setFailed(err.message);
});
