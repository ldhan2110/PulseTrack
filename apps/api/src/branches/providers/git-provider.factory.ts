import { Injectable, BadRequestException } from '@nestjs/common';
import type { GitProvider } from './git-provider.interface';
import { GitHubProvider } from './github.provider';
import { GitLabProvider } from './gitlab.provider';

@Injectable()
export class GitProviderFactory {
  create(provider: string): GitProvider {
    switch (provider) {
      case 'github':
        return new GitHubProvider();
      case 'gitlab':
        return new GitLabProvider();
      default:
        throw new BadRequestException(`Unsupported git provider: ${provider}`);
    }
  }
}
