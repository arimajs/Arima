import { RequestContext } from '@mikro-orm/core';
import { createMethodDecorator } from '@sapphire/decorators';
import { container } from '@sapphire/framework';

/**
 * This decorator wraps the code of the method it decorates in a new RequestContext.
 * @see https://mikro-orm.io/docs/identity-map
 */
export const UseForkedEm = createMethodDecorator((_target, _propertyKey, descriptor: PropertyDescriptor) => {
	const originalMethod = descriptor.value;

	// Full function syntax required to preserve `this` context.
	// eslint-disable-next-line func-names
	descriptor.value = async function (...args: unknown[]) {
		const { db } = container;
		await RequestContext.createAsync(db.em, originalMethod.bind(this, ...args));
	};
});
