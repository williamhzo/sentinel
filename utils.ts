type Message = {
  toolName: string;
  changelog: string;
  link: string;
};

export function generateMessage({
  toolName,
  changelog,
  link,
}: Message): string {
  return `${toolName} release

${changelog.toLowerCase()}

${link}`;
}
