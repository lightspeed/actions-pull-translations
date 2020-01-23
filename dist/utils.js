"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const execa_1 = require("execa");
const fs_1 = require("fs");
const mustache_1 = require("mustache");
const util_1 = require("util");
const readFileAsync = util_1.promisify(fs_1.readFile);
/**
 * Runs a shell command and dumps the output to the GitHub Actions log
 * @param commandString The command to run
 */
const runShellCommand = (commandString) => __awaiter(void 0, void 0, void 0, function* () {
    core.info(`$ ${commandString}`);
    try {
        const { stdout, stderr } = yield execa_1.command(commandString, { shell: true });
        const output = [stdout, stderr].filter(Boolean).join('\n');
        core.info(output);
        return output;
    }
    catch (error) {
        core.info(util_1.inspect(error));
        throw error;
    }
});
/**
 * Extract translation parameters from the issue body
 * @param body The issue body
 */
exports.extractParamsFromBody = (body) => {
    core.info(`Extracting parameters from issue body`);
    const lines = body.split('\r\n');
    const [, , ...paramLines] = lines.filter(line => line.match(/^\|\s*(.*?)(?=\s*\|)\s*\|\s*(.*?)(?=\s*\|)\s*\|/g));
    const rawParams = Object.fromEntries(paramLines.map(line => {
        const match = /^\|\s*(.*?)(?=\s*\|)\s*\|\s*(.*?)(?=\s*\|)\s*\|/g.exec(line);
        return [match[1], match[2]];
    }));
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
exports.pullTranslations = (project, resource, languages) => __awaiter(void 0, void 0, void 0, function* () {
    core.info(`Pulling translations from Transifex`);
    const fullResource = `${project}.${resource}`;
    yield runShellCommand(`tx pull --mode reviewed -f -l ${languages.join(',')} -r ${fullResource}`);
});
/**
 * Creates a branch, makes a commit, and pushes the changes to the remote
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 */
exports.pushChangesToRemote = (project, resource) => __awaiter(void 0, void 0, void 0, function* () {
    core.info(`Pushing changes to remote`);
    const fullResource = `${project}.${resource}`;
    yield runShellCommand(`git config --global user.name "GitHub Action"`);
    yield runShellCommand(`git config --global user.email "action@github.com"`);
    yield runShellCommand('git add .');
    yield runShellCommand(`git commit -m "Auto-committed translation changes for ${fullResource}"`);
    yield runShellCommand(`git checkout -b feature/translations/${fullResource}`);
    yield runShellCommand(`git push -f https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git HEAD:refs/heads/feature/translations/${fullResource}`);
});
/**
 * Creates a pull request to the master branch
 * @param project The project namespace, i.e.: retail-pos-web
 * @param resource The resource name, i.e.: retail-reports
 * @param languages The languages to pull, i.e.: ['fr', 'de']
 * @param issueNumber The issue number that triggered this pull
 */
exports.createPullRequest = (project, resource, languages, issueNo) => __awaiter(void 0, void 0, void 0, function* () {
    core.info(`Creating pull request to master`);
    const fullResource = `${project}.${resource}`;
    const template = yield readFileAsync(__dirname + '/../template.md', 'utf8');
    const title = `[TRANSLATIONS] Pull translations for ${resource}`;
    const body = mustache_1.render(template, { project, resource, languages, issueNo });
    const head = `feature/translations/${fullResource}`;
    const base = 'master';
    const token = process.env.GITHUB_TOKEN;
    const octokit = new github.GitHub(token);
    try {
        yield octokit.pulls.create(Object.assign(Object.assign({}, github.context.repo), { head, base, title, body }));
    }
    catch (err) {
        core.info(`Failed to create PR: ${err.message}`);
    }
});
