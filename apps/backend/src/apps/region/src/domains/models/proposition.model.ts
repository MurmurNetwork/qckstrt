import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

/**
 * Proposition status enum for GraphQL
 */
export enum PropositionStatusGQL {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  WITHDRAWN = 'withdrawn',
}

registerEnumType(PropositionStatusGQL, {
  name: 'PropositionStatus',
  description: 'The status of a proposition',
});

/**
 * Proposition GraphQL model
 */
@ObjectType()
export class PropositionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  externalId!: string;

  @Field()
  title!: string;

  @Field()
  summary!: string;

  @Field({ nullable: true })
  fullText?: string;

  @Field(() => PropositionStatusGQL)
  status!: PropositionStatusGQL;

  @Field({ nullable: true })
  electionDate?: Date;

  @Field({ nullable: true })
  sourceUrl?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Paginated propositions response
 */
@ObjectType()
export class PaginatedPropositions {
  @Field(() => [PropositionModel])
  items!: PropositionModel[];

  @Field(() => Int)
  total!: number;

  @Field()
  hasMore!: boolean;
}
