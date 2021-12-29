import { createMethodDecorator } from '@sapphire/decorators';
import { container } from '@sapphire/framework';

/**
 * This decorator modifies the execution of what of method it decorates to wrap the login in the AsyncLocalStorage context.
 * @see https://mikro-orm.io/docs/identity-map
 */
export const ForkEm = createMethodDecorator((_target, _propertyKey, descriptor: PropertyDescriptor) => {
	const originalMethod = descriptor.value;

	// Full function syntax required to preserve `this` context.
	// eslint-disable-next-line func-names
	descriptor.value = function (...args: unknown[]) {
		const { db } = container;
		db.storage.run(db.em.fork(true, true), originalMethod.bind(this, ...args));
	};
});
