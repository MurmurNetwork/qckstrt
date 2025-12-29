import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

/**
 * Meeting GraphQL model
 */
@ObjectType()
export class MeetingModel {
  @Field(() => ID)
  id!: string;

  @Field()
  externalId!: string;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  scheduledAt!: Date;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  agendaUrl?: string;

  @Field({ nullable: true })
  videoUrl?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/**
 * Paginated meetings response
 */
@ObjectType()
export class PaginatedMeetings {
  @Field(() => [MeetingModel])
  items!: MeetingModel[];

  @Field(() => Int)
  total!: number;

  @Field()
  hasMore!: boolean;
}
