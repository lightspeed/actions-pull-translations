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
const utils_1 = require("./utils");
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    core.info(`㊗️ Pulling translations from Transifex`);
    const project = core.getInput('project', { required: true });
    const resource = core.getInput('resource', { required: true });
    const languages = core.getInput('languages', { required: true }).split(',');
    const mode = core.getInput('mode', { required: true });
    const branch = core.getInput('branch', { required: true });
    const addPullerAsAssignee = core.getBooleanInput('addPullerAsAssignee');
    const addPullerAsReviewer = core.getBooleanInput('addPullerAsReviewer');
    yield utils_1.pullTranslations(project, resource, languages, mode, branch);
    yield utils_1.pushChangesToRemote(project, resource);
    const pullRequest = yield utils_1.createPullRequest(project, resource, languages, mode, branch);
    if (pullRequest) {
        yield utils_1.addAssignee(pullRequest, addPullerAsAssignee);
        yield utils_1.requestReviewer(pullRequest, addPullerAsReviewer);
    }
    core.info(`Done processing new translations for ${resource}`);
});
run().catch((err) => {
    core.setFailed(err.message);
});