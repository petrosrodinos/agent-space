import { Module } from '@nestjs/common';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { KnowledgeVectorStore } from './knowledge-vector.store';

@Module({
    imports: [AiIntegrationModule],
    controllers: [KnowledgeController],
    providers: [KnowledgeService, KnowledgeIndexerService, KnowledgeVectorStore],
    exports: [KnowledgeService, KnowledgeIndexerService],
})
export class KnowledgeModule { }
