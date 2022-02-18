import { UseRequestContext as OriginalUseRequestContext } from '@mikro-orm/core';
import { container } from '@sapphire/framework';

/**
 * This decorator wraps the code of the method it decorates in a new RequestContext.
 * @see https://mikro-orm.io/docs/identity-map
 */
export const UseRequestContext = OriginalUseRequestContext.bind(null, container.db.orm);
