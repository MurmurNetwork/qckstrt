import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';

/**
 * Civic data types enum for GraphQL
 */
export enum CivicDataTypeGQL {
  PROPOSITIONS = 'propositions',
  MEETINGS = 'meetings',
  REPRESENTATIVES = 'representatives',
}

registerEnumType(CivicDataTypeGQL, {
  name: 'CivicDataType',
  description: 'Types of civic data available in the region',
});

/**
 * Region info GraphQL model
 */
@ObjectType()
export class RegionInfoModel {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  timezone!: string;

  @Field(() => [String], { nullable: true })
  dataSourceUrls?: string[];

  @Field(() => [CivicDataTypeGQL])
  supportedDataTypes!: CivicDataTypeGQL[];
}

/**
 * Sync result for a data type
 */
@ObjectType()
export class SyncResultModel {
  @Field(() => CivicDataTypeGQL)
  dataType!: CivicDataTypeGQL;

  @Field()
  itemsProcessed!: number;

  @Field()
  itemsCreated!: number;

  @Field()
  itemsUpdated!: number;

  @Field(() => [String])
  errors!: string[];

  @Field()
  syncedAt!: Date;
}
