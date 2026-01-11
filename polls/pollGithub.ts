import { Octokit } from "@octokit/rest";

export async function savePollResultToGithub(
  repoOwner: string,
  repoName: string,
  token: string,
  filePath: string,
  contentObj: any
) {
  const octokit = new Octokit({ auth: token });

  const content = Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64");

  let sha: string | undefined = undefined;

  try {
    const existing = await octokit.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: filePath,
    });

    // @ts-ignore
    sha = existing.data.sha;
  } catch (_e) {
    // File not found — OK
  }

  await octokit.repos.createOrUpdateFileContents({
    owner: repoOwner,
    repo: repoName,
    path: filePath,
    message: `Poll result update: ${new Date().toISOString()}`,
    content,
    sha,
  });
}
