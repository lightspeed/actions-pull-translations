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
const utils_1 = require("./utils");
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    const { body, number, title } = github.context.payload.issue;
    if (!title.startsWith('[TRANSLATIONS]')) {
        core.info(`Ignoring issue with title ${title}`);
        process.exit(0);
    }
    core.info(`㊗️ Pulling translations from Transifex`);
    const { project, resource, languages, mode } = utils_1.extractParamsFromBody(body);
    yield utils_1.pullTranslations(project, resource, languages, mode);
    yield utils_1.pushChangesToRemote(project, resource);
    yield utils_1.createPullRequest(project, resource, languages, mode, number);
    core.info(`Done processing new translations for ${resource}`);
});
run().catch((err) => {
    core.setFailed(err.message);
});
