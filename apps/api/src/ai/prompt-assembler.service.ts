export interface PromptSection {
  key: string;
  content: string | null | undefined;
}

export class PromptAssembler {
  assemble(sections: PromptSection[]): string {
    return sections
      .filter((s) => s.content?.trim())
      .map((s) => s.content!.trim())
      .join('\n\n');
  }
}
