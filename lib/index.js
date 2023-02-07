"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const runtime_1 = require("@prisma/client/runtime");
const jest_mock_extended_1 = require("jest-mock-extended");
const defaults_1 = __importStar(require("./defaults"));
const shallowCompare_1 = require("./utils/shallowCompare");
const deepEqual_1 = require("./utils/deepEqual");
function IsFieldDefault(f) {
    return f.name !== undefined;
}
const createPrismaMock = (data = {}, datamodel, client = (0, jest_mock_extended_1.mockDeep)(), options = { caseInsensitive: false }) => {
    if (!datamodel || typeof datamodel === "string") {
        datamodel = client_1.Prisma.dmmf.datamodel;
    }
    (0, defaults_1.ResetDefaults)();
    const getCamelCase = (name) => {
        return name.substr(0, 1).toLowerCase() + name.substr(1);
    };
    const removeMultiFieldIds = (model, data) => {
        const c = getCamelCase(model.name);
        const idFields = model.idFields || model.primaryKey?.fields;
        const removeId = (ids) => {
            const id = ids.join("_");
            data = {
                ...data,
                [c]: data[c].map((item) => {
                    const { [id]: idVal, ...rest } = item;
                    return {
                        ...rest,
                        ...idVal,
                    };
                }),
            };
        };
        if (idFields?.length > 1) {
            removeId(idFields);
        }
        if (model.uniqueFields?.length > 0) {
            for (const uniqueField of model.uniqueFields) {
                removeId(uniqueField);
            }
        }
        return data;
    };
    const getFieldRelationshipWhere = (item, field) => {
        if (field.relationToFields.length === 0) {
            field = getJoinField(field);
            return {
                [field.relationFromFields[0]]: item[field.relationToFields[0]],
            };
        }
        return {
            [field.relationToFields[0]]: item[field.relationFromFields[0]],
        };
    };
    const getJoinField = (field) => {
        const joinmodel = datamodel.models.find((model) => {
            return model.name === field.type;
        });
        const joinfield = joinmodel?.fields.find((f) => {
            return f.relationName === field.relationName;
        });
        return joinfield;
    };
    // @ts-ignore
    client["$transaction"].mockImplementation(async (actions) => {
        for (const action of actions) {
            await action;
        }
    });
    const Delegate = (prop, model) => {
        const sortFunc = (orderBy) => (a, b) => {
            if (Array.isArray(orderBy)) {
                for (const order of orderBy) {
                    const res = sortFunc(order)(a, b);
                    if (res !== 0) {
                        return res;
                    }
                }
                return 0;
            }
            const keys = Object.keys(orderBy);
            if (keys.length > 1) {
                throw new runtime_1.PrismaClientValidationError(`Argument orderBy of needs exactly one argument, but you provided ${keys.join(" and ")}. Please choose one.`);
            }
            const incl = includes({
                include: keys.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
            });
            for (const key of keys) {
                const dir = orderBy[key];
                if (typeof dir === "object") {
                    const schema = model.fields.find((field) => {
                        return field.name === key;
                    });
                    if (!schema) {
                        return 0;
                    }
                    const submodel = datamodel.models.find((model) => {
                        return model.name === schema.type;
                    });
                    const delegate = Delegate(getCamelCase(schema.type), submodel);
                    const valA = incl(a);
                    const valB = incl(b);
                    if (!valB || !valB[key]) {
                        return 0;
                    }
                    if (!valA || !valA[key]) {
                        return 0;
                    }
                    const res = delegate._sortFunc(dir)(valA[key], valB[key]);
                    if (res !== 0) {
                        return res;
                    }
                }
                else if (!!a && !!b) {
                    if (a[key] > b[key]) {
                        return dir === "asc" ? 1 : -1;
                    }
                    else if (a[key] < b[key]) {
                        return dir === "asc" ? -1 : 1;
                    }
                }
            }
            return 0;
        };
        const nestedUpdate = (args, isCreating, item) => {
            let d = args.data;
            Object.entries(d).forEach(([key, value]) => {
                if (typeof value === "undefined") {
                    delete d[key];
                }
            });
            // Get field schema for default values
            const model = datamodel.models.find((model) => {
                return getCamelCase(model.name) === prop;
            });
            model.fields.forEach((field) => {
                if (d[field.name]) {
                    const c = d[field.name];
                    if (field.kind === "object") {
                        if (c.connect) {
                            const { [field.name]: { connect }, ...rest } = d;
                            const connections = connect instanceof Array ? connect : [connect];
                            connections.forEach((connect, idx) => {
                                const keyToMatch = Object.keys(connect)[0];
                                if (field.relationToFields.length > 0) {
                                    const keyToGet = field.relationToFields[0];
                                    const targetKey = field.relationFromFields[0];
                                    let connectionValue = connect[keyToGet];
                                    if (keyToMatch !== keyToGet) {
                                        const valueToMatch = connect[keyToMatch];
                                        const matchingRow = data[getCamelCase(field.type)].find((row) => {
                                            return row[keyToMatch] === valueToMatch;
                                        });
                                        if (!matchingRow) {
                                            const message = "An operation failed because it depends on one or more records that were required but not found. {cause}";
                                            const code = "P2025";
                                            const clientVersion = "1.2.3";
                                            // PrismaClientKnownRequestError prototype changed in version 4.7.0
                                            // from: constructor(message: string, code: string, clientVersion: string, meta?: any)
                                            // to: constructor(message: string, { code, clientVersion, meta, batchRequestIdx }: KnownErrorParams)
                                            if (runtime_1.PrismaClientKnownRequestError.length === 2) {
                                                // @ts-ignore
                                                throw new runtime_1.PrismaClientKnownRequestError(message, {
                                                    code,
                                                    clientVersion,
                                                });
                                            }
                                            // @ts-ignore
                                            throw new runtime_1.PrismaClientKnownRequestError(message, code, 
                                            // @ts-ignore
                                            clientVersion);
                                        }
                                        connectionValue = matchingRow[keyToGet];
                                    }
                                    d = {
                                        ...rest,
                                        [targetKey]: connectionValue,
                                    };
                                }
                                else {
                                    d = rest;
                                    const otherModel = datamodel.models.find((model) => {
                                        return model.name === field.type;
                                    });
                                    const inverse = otherModel.fields.find((otherField) => field.relationName === otherField.relationName);
                                    const targetKey = inverse.relationToFields[0];
                                    const fromKey = inverse.relationFromFields[0];
                                    const delegate = Delegate(getCamelCase(otherModel.name), otherModel);
                                    delegate.update({
                                        where: {
                                            [fromKey]: connect[keyToMatch],
                                        },
                                        data: {
                                            [getCamelCase(inverse.name)]: {
                                                connect: {
                                                    [targetKey]: d[targetKey],
                                                },
                                            },
                                        },
                                    });
                                }
                            });
                        }
                        if (c.create || c.createMany) {
                            const { [field.name]: create, ...rest } = d;
                            d = rest;
                            // @ts-ignore
                            const name = getCamelCase(field.type);
                            const delegate = Delegate(name, model);
                            const joinfield = getJoinField(field);
                            if (field.relationFromFields.length > 0) {
                                const item = delegate.create({
                                    data: create.create,
                                });
                                d = {
                                    ...rest,
                                    [field.relationFromFields[0]]: item[field.relationToFields[0]],
                                };
                            }
                            else {
                                const map = (val) => ({
                                    ...val,
                                    [joinfield.name]: {
                                        connect: joinfield.relationToFields.reduce((prev, cur, index) => {
                                            let val = d[cur];
                                            if (!isCreating && !val) {
                                                val = findOne(args)[cur];
                                            }
                                            return {
                                                ...prev,
                                                [cur]: val,
                                            };
                                        }, {}),
                                    },
                                });
                                if (c.createMany) {
                                    delegate.createMany({
                                        ...c.createMany,
                                        data: c.createMany.data.map(map),
                                    });
                                }
                                else {
                                    if (Array.isArray(c.create)) {
                                        delegate.createMany({
                                            ...c.create,
                                            data: c.create.map(map),
                                        });
                                    }
                                    else {
                                        delegate.create({
                                            ...create.create,
                                            data: map(create.create),
                                        });
                                    }
                                }
                            }
                        }
                        const name = getCamelCase(field.type);
                        const delegate = Delegate(name, model);
                        if (c.updateMany) {
                            if (Array.isArray(c.updateMany)) {
                                c.updateMany.forEach((updateMany) => {
                                    delegate.updateMany(updateMany);
                                });
                            }
                            else {
                                delegate.updateMany(c.updateMany);
                            }
                        }
                        if (c.update) {
                            if (Array.isArray(c.update)) {
                                c.update.forEach((update) => {
                                    delegate.update(update);
                                });
                            }
                            else {
                                const item = findOne(args);
                                delegate.update({
                                    data: c.update,
                                    where: getFieldRelationshipWhere(item, field),
                                });
                            }
                        }
                        if (c.deleteMany) {
                            if (Array.isArray(c.deleteMany)) {
                                c.deleteMany.forEach((where) => {
                                    delegate.deleteMany({ where });
                                });
                            }
                            else {
                                delegate.deleteMany({ where: c.deleteMany });
                            }
                        }
                        if (c.delete) {
                            if (Array.isArray(c.delete)) {
                                c.delete.forEach((where) => {
                                    delegate.delete({ where });
                                });
                            }
                            else {
                                delegate.delete({ where: c.delete });
                            }
                        }
                        if (c.disconnect) {
                            if (field.relationFromFields.length > 0) {
                                d = {
                                    ...d,
                                    [field.relationFromFields[0]]: null,
                                };
                            }
                            else {
                                const joinfield = getJoinField(field);
                                delegate.update({
                                    data: {
                                        [joinfield.relationFromFields[0]]: null,
                                    },
                                    where: {
                                        [joinfield.relationFromFields[0]]: item[joinfield.relationToFields[0]],
                                    },
                                });
                            }
                        }
                        const { [field.name]: _update, ...rest } = d;
                        d = rest;
                    }
                    if (c.increment) {
                        d = {
                            ...d,
                            [field.name]: item[field.name] + c.increment,
                        };
                    }
                    if (c.decrement) {
                        d = {
                            ...d,
                            [field.name]: item[field.name] - c.decrement,
                        };
                    }
                    if (c.multiply) {
                        d = {
                            ...d,
                            [field.name]: item[field.name] * c.multiply,
                        };
                    }
                    if (c.divide) {
                        d = {
                            ...d,
                            [field.name]: item[field.name] / c.divide,
                        };
                    }
                    if (c.set) {
                        d = {
                            ...d,
                            [field.name]: c.set,
                        };
                    }
                }
                if ((isCreating || d[field.name] === null) &&
                    (d[field.name] === null || d[field.name] === undefined)) {
                    if (field.hasDefaultValue) {
                        if (IsFieldDefault(field.default)) {
                            const defaultValue = (0, defaults_1.default)(prop, field, data);
                            if (defaultValue) {
                                d = {
                                    ...d,
                                    [field.name]: defaultValue,
                                };
                            }
                        }
                        else {
                            d = {
                                ...d,
                                [field.name]: field.default,
                            };
                        }
                    }
                    else if (field.isUpdatedAt) {
                        d = {
                            ...d,
                            [field.name]: new Date(),
                        };
                    }
                    else {
                        if (field.kind !== "object") {
                            d = {
                                ...d,
                                [field.name]: null,
                            };
                        }
                    }
                }
                // return field.name === key
            });
            return d;
        };
        const matchItem = (child, item, where) => {
            let val = item[child];
            const filter = where[child];
            if (child === "OR") {
                return matchOr(item, filter);
            }
            if (child === "AND") {
                return matchAnd(item, filter);
            }
            if (child === "NOT") {
                return !matchOr(item, filter);
            }
            if (filter == null || filter === undefined) {
                if (filter === null) {
                    return val === null || val === undefined;
                }
                return true;
            }
            if (filter instanceof Date) {
                if (val === undefined) {
                    return false;
                }
                if (!(val instanceof Date) || val.getTime() !== filter.getTime()) {
                    return false;
                }
            }
            else {
                if (typeof filter === "object") {
                    const info = model.fields.find((field) => field.name === child);
                    if (info?.relationName) {
                        const childName = getCamelCase(info.type);
                        let childWhere = {};
                        if (filter.every) {
                            childWhere = filter.every;
                        }
                        else if (filter.some) {
                            childWhere = filter.some;
                        }
                        else if (filter.none) {
                            childWhere = filter.none;
                        }
                        else {
                            childWhere = filter;
                        }
                        const submodel = datamodel.models.find((model) => {
                            return getCamelCase(model.name) === childName;
                        });
                        const delegate = Delegate(getCamelCase(childName), submodel);
                        const res = delegate.findMany({
                            where: {
                                ...childWhere,
                                ...getFieldRelationshipWhere(item, info),
                            },
                        });
                        if (filter.every) {
                            if (res.length === 0)
                                return false;
                            // const all = data[childName].filter(
                            //   matchFnc(getFieldRelationshipWhere(item, info)),
                            // )
                            const all = delegate.findMany({
                                where: getFieldRelationshipWhere(item, info),
                            });
                            return res.length === all.length;
                        }
                        else if (filter.some) {
                            return res.length > 0;
                        }
                        else if (filter.none) {
                            return res.length === 0;
                        }
                        return res.length > 0;
                    }
                    const idFields = model.idFields || model.primaryKey?.fields;
                    if (idFields?.length > 1) {
                        if (child === idFields.join("_")) {
                            return (0, shallowCompare_1.shallowCompare)(item, filter);
                        }
                    }
                    if (model.uniqueFields?.length > 0) {
                        for (const uniqueField of model.uniqueFields) {
                            if (child === uniqueField.join("_")) {
                                return (0, shallowCompare_1.shallowCompare)(item, filter);
                            }
                        }
                    }
                    if (val === undefined) {
                        return false;
                    }
                    let match = true;
                    const matchFilter = { ...filter };
                    if (options.caseInsensitive) {
                        val = val.toLowerCase ? val.toLowerCase() : val;
                        Object.keys(matchFilter).forEach((key) => {
                            const value = matchFilter[key];
                            if (value.toLowerCase) {
                                matchFilter[key] = value.toLowerCase();
                            }
                            else if (value instanceof Array) {
                                matchFilter[key] = value.map((v) => v.toLowerCase ? v.toLowerCase() : v);
                            }
                        });
                    }
                    if ("equals" in matchFilter && match) {
                        match = (0, deepEqual_1.deepEqual)(matchFilter.equals, val);
                    }
                    if ("startsWith" in matchFilter && match) {
                        match = val.indexOf(matchFilter.startsWith) === 0;
                    }
                    if ("endsWith" in matchFilter && match) {
                        match =
                            val.indexOf(matchFilter.endsWith) ===
                                val.length - matchFilter.endsWith.length;
                    }
                    if ("contains" in matchFilter && match) {
                        match = val.indexOf(matchFilter.contains) > -1;
                    }
                    if ("gt" in matchFilter && match) {
                        match = val > matchFilter.gt;
                    }
                    if ("gte" in matchFilter && match) {
                        match = val >= matchFilter.gte;
                    }
                    if ("lt" in matchFilter && match) {
                        match = val < matchFilter.lt;
                    }
                    if ("lte" in matchFilter && match) {
                        match = val <= matchFilter.lte;
                    }
                    if ("in" in matchFilter && match) {
                        match = matchFilter.in.includes(val);
                    }
                    if ("not" in matchFilter && match) {
                        match = !(0, deepEqual_1.deepEqual)(matchFilter.not, val);
                    }
                    if ("notIn" in matchFilter && match) {
                        match = !matchFilter.notIn.includes(val);
                    }
                    if (!match)
                        return false;
                }
                else if (val !== filter) {
                    return false;
                }
            }
            return true;
        };
        const matchItems = (item, where) => {
            for (let child in where) {
                if (!matchItem(child, item, where)) {
                    return false;
                }
            }
            return true;
        };
        const matchAnd = (item, where) => {
            return where.filter((child) => matchItems(item, child)).length > 0;
        };
        const matchOr = (item, where) => {
            return where.some((child) => matchItems(item, child));
        };
        const matchFnc = (where) => (item) => {
            if (where) {
                return matchItems(item, where);
            }
            return true;
        };
        const findOne = (args) => {
            if (!data[prop])
                return null;
            const items = findMany(args);
            if (items.length === 0) {
                return null;
            }
            return items[0];
        };
        const findMany = (args) => {
            let res = data[prop].filter(matchFnc(args?.where)).map(includes(args));
            if (args?.distinct) {
                let values = {};
                res = res.filter((item) => {
                    let shouldInclude = true;
                    args.distinct.forEach((key) => {
                        const vals = values[key] || [];
                        if (vals.includes(item[key])) {
                            shouldInclude = false;
                        }
                        else {
                            vals.push(item[key]);
                            values[key] = vals;
                        }
                    });
                    return shouldInclude;
                });
            }
            if (args?.orderBy) {
                res.sort(sortFunc(args?.orderBy));
            }
            if (args?.select) {
                res = res.map((item) => {
                    const newItem = {};
                    Object.keys(args.select).forEach((key) => (newItem[key] = item[key]));
                    return newItem;
                });
            }
            if (args?.skip !== undefined || args?.take !== undefined) {
                const start = args?.skip !== undefined ? args?.skip : 0;
                const end = args?.take !== undefined ? start + args.take : undefined;
                res = res.slice(start, end);
            }
            return res;
        };
        const updateMany = (args) => {
            // if (!Array.isArray(data[prop])) {
            //   throw new Error(`${prop} not found in data`)
            // }
            const newItems = data[prop].map((e) => {
                if (matchFnc(args.where)(e)) {
                    let data = nestedUpdate(args, false, e);
                    return {
                        ...e,
                        ...data,
                    };
                }
                return e;
            });
            data = {
                ...data,
                [prop]: newItems,
            };
            data = removeMultiFieldIds(model, data);
            return data;
        };
        const create = (args) => {
            const d = nestedUpdate(args, true, null);
            data = {
                ...data,
                [prop]: [...data[prop], d],
            };
            data = removeMultiFieldIds(model, data);
            let where = {};
            for (const field of model.fields) {
                if (field.default) {
                    where[field.name] = d[field.name];
                }
            }
            return findOne({ where, ...args });
        };
        const deleteMany = (args) => {
            const model = datamodel.models.find((model) => {
                return getCamelCase(model.name) === prop;
            });
            const deleted = [];
            data = {
                ...data,
                [prop]: data[prop].filter((e) => {
                    const shouldDelete = matchFnc(args?.where)(e);
                    if (shouldDelete) {
                        deleted.push(e);
                    }
                    return !shouldDelete;
                }),
            };
            // Referential Actions
            deleted.forEach((item) => {
                model.fields.forEach((field) => {
                    const joinfield = getJoinField(field);
                    if (!joinfield)
                        return;
                    const delegate = Delegate(getCamelCase(field.type), model);
                    if (joinfield.relationOnDelete === "SetNull") {
                        delegate.update({
                            where: {
                                [joinfield.relationFromFields[0]]: item[joinfield.relationToFields[0]],
                            },
                            data: {
                                [joinfield.relationFromFields[0]]: null,
                            },
                        });
                    }
                    else if (joinfield.relationOnDelete === "Cascade") {
                        delegate.delete({
                            where: {
                                [joinfield.relationFromFields[0]]: item[joinfield.relationToFields[0]],
                            },
                        });
                    }
                });
            });
            return deleted;
        };
        const includes = (args) => (item) => {
            if ((!args?.include && !args?.select) || !item)
                return item;
            let newItem = item;
            const obj = args?.select || args?.include;
            const keys = Object.keys(obj);
            keys.forEach((key) => {
                // Get field schema for relation info
                const model = datamodel.models.find((model) => {
                    return getCamelCase(model.name) === prop;
                });
                const schema = model.fields.find((field) => {
                    return field.name === key;
                });
                if (!schema?.relationName) {
                    return;
                }
                // Get delegate for relation
                const delegate = Delegate(getCamelCase(schema.type), model);
                // Construct arg for relation query
                let subArgs = obj[key] === true ? {} : obj[key];
                subArgs = {
                    ...subArgs,
                    where: {
                        ...subArgs.where,
                        ...getFieldRelationshipWhere(item, schema),
                    },
                };
                if (schema.isList) {
                    // Add relation
                    newItem = {
                        ...newItem,
                        [key]: delegate.findMany(subArgs),
                    };
                }
                else {
                    newItem = {
                        ...newItem,
                        [key]: delegate.findUnique(subArgs),
                    };
                }
            });
            return newItem;
        };
        const update = (args) => {
            let updatedItem;
            const newItems = data[prop].map((e) => {
                if (matchFnc(args.where)(e)) {
                    let data = nestedUpdate(args, false, e);
                    updatedItem = {
                        ...e,
                        ...data,
                    };
                    return updatedItem;
                }
                return e;
            });
            data = {
                ...data,
                [prop]: newItems,
            };
            data = removeMultiFieldIds(model, data);
            return findOne({ ...args, where: updatedItem });
        };
        return {
            findOne,
            findUnique: findOne,
            findMany,
            findFirst: findOne,
            findFirstOrThrow: (args) => {
                const found = findOne(args);
                if (!found) {
                    throw new runtime_1.PrismaClientKnownRequestError("An operation failed because it depends on one or more records that were required but not found. {cause}", "P2025", 
                    // @ts-ignore
                    "1.2.3");
                }
                return found;
            },
            create,
            createMany: (args) => {
                args.data.forEach((data) => {
                    create({
                        ...args,
                        data,
                    });
                });
                return findMany(args);
            },
            delete: (args) => {
                const deleted = deleteMany(args);
                if (deleted.length) {
                    return deleted[0];
                }
                return null;
            },
            update,
            deleteMany,
            updateMany: (args) => {
                updateMany(args);
                return findMany(args);
            },
            upsert(args) {
                const res = findOne(args);
                if (res) {
                    return update({
                        ...args,
                        data: args.update,
                    });
                }
                else {
                    create({
                        ...args,
                        data: {
                            ...args.where,
                            ...args.create,
                        },
                    });
                    return findOne(args);
                }
            },
            count(args) {
                const res = findMany(args);
                return res.length;
            },
            _sortFunc: sortFunc,
        };
    };
    datamodel.models.forEach((model) => {
        if (!model)
            return;
        const c = getCamelCase(model.name);
        if (!data[c]) {
            data = {
                ...(data || {}),
                [c]: [],
            };
        }
        data = removeMultiFieldIds(model, data);
        const objs = Delegate(c, model);
        Object.keys(objs).forEach((fncName) => {
            if (fncName.indexOf("_") === 0)
                return;
            client[c][fncName].mockImplementation(async (...params) => {
                return objs[fncName](...params);
            });
        });
    });
    return client;
};
exports.default = createPrismaMock;