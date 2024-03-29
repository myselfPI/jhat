/*
 * Copyright (c) 2005, 2008, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

/*
 * The Original Code is HAT. The Initial Developer of the
 * Original Code is Bill Foote, with contributions from others
 * at JavaSoft/Sun.
 */

var hatPkg = Packages.com.sun.tools.hat.gkinternal;

/**
 * This is JavaScript interface for heap analysis using HAT
 * (Heap Analysis Tool). HAT classes are refered from
 * this file. In particular, refer to classes in hat.model
 * package.
 *
 * HAT model objects are wrapped as convenient script objects so that
 * fields may be accessed in natural syntax. For eg. Java fields can be
 * accessed with obj.field_name syntax and array elements can be accessed
 * with array[index] syntax.
 */

// returns an iterator that wraps elements of
// the input iterator elements.
function wrapperIterator(e, wrapFunc) {
    if (wrapFunc == undefined) wrapFunc = wrapJavaValue;
    return new java.util.Iterator() {
        hasNext: function() {
            return e.hasNext();
        },
        next: function() {
            return wrapFunc(e.next());
        }
    };
}

// returns an iterator that filters out elements
// of input iterator using the filter function.
function filterIterator(e, func, wrap) {
    var next = undefined;
    var index = 0;

    function findNext() {
        var tmp;
        while (next === undefined && e.hasNext()) {
            tmp = e.next();
            index++;
            if (wrap) {
                tmp = wrapJavaValue(tmp);
            }
            if (func(tmp, index, e)) {
                next = tmp;
            }
        }
    }

    return new java.util.Iterator() {
        hasNext: function() {
            findNext();
            return next !== undefined;
        },

        next: function() {
            if (next === undefined) {
                // user may not have called hasNext?
                findNext();
            }
            if (next === undefined) {
                throw new java.util.NoSuchElementException();
            }
            var res = next;
            next = undefined;
            return res;
        }
    };
}

// iterator that has no elements ..
var emptyIterator = java.util.Collections.emptySet().iterator();

function wrapRoot(root) {
    if (root) {
        return {
            id: root.idString,
            description: root.description,
            referrer: wrapJavaValue(root.referer),
            type: root.typeName
        };
    } else {
        return null;
    }
}

function JavaClassProto() {
    function jclass(obj) {
        return obj['wrapped-object'];
    }

    // return whether given class is subclass of this class or not
    this.isSubclassOf = function(other) {
        var tmp = jclass(this);
        var otherid = objectid(other);
        while (tmp != null) {
            if (otherid.equals(tmp.idString)) {
                return true;
            }
            tmp = tmp.superclass;
        }
        return false;
    }

    // return whether given class is superclass of this class or not
    this.isSuperclassOf = function(other) {
        return other.isSubclassOf(this);
    }

    // includes direct and indirect superclasses
    this.superclasses = function() {
        var res = [];
        var tmp = this.superclass;
        while (tmp != null) {
            res.push(tmp);
            tmp = tmp.superclass;
        }
        return res;
    }

    /**
     * Returns an array containing subclasses of this class.
     *
     * @param indirect should include indirect subclasses or not.
     *                 default is true.
     */
    this.subclasses = function(indirect) {
        if (indirect == undefined) indirect = true;
        var classes = jclass(this).subclasses;
        var res = [];
        for (var i = 0; i < classes.length; ++i) {
            var subclass = wrapJavaValue(classes[i]);
            res.push(subclass);
            if (indirect) {
                res = res.concat(subclass.subclasses());
            }
        }
        return res;
    }
    this.toString = function() { return jclass(this).toString(); }
}

var theJavaClassProto = new JavaClassProto();

// Script wrapper for HAT model objects, values.
// wraps a Java value as appropriate for script object
function wrapJavaValue(thing) {
    if (thing == null || thing == undefined ||
        thing instanceof hatPkg.model.HackJavaValue) {
        return null;
    }

    if (thing instanceof hatPkg.model.JavaValue) {
        // map primitive values to closest JavaScript primitives
        if (thing instanceof hatPkg.model.JavaBoolean) {
            return thing.toString() == "true";
        } else if (thing instanceof hatPkg.model.JavaChar) {
            return thing.toString() + '';
        } else {
            return java.lang.Double.parseDouble(thing.toString());
        }
    } else {
        // wrap Java object as script object
        return wrapJavaObject(thing);
    }
}

// wrap Java object with appropriate script object
function wrapJavaObject(thing) {

    // HAT Java model object wrapper. Handles all cases
    // (instance, object/primitive array and Class objects)
    function javaObject(jobject) {
        // FIXME: Do I need this? or can I assume that these would
        // have been resolved already?
        if (jobject instanceof hatPkg.model.JavaObjectRef) {
            jobject = jobject.dereference();
            if (jobject instanceof hatPkg.model.HackJavaValue) {
                println(jobject);
                return null;
            }
        }

        if (jobject instanceof hatPkg.model.JavaObject) {
            return new JavaObjectWrapper(jobject);
        } else if (jobject instanceof hatPkg.model.JavaClass) {
            return new JavaClassWrapper(jobject);
        } else if (jobject instanceof hatPkg.model.JavaObjectArray) {
            return new JavaObjectArrayWrapper(jobject);
        } else if (jobject instanceof hatPkg.model.JavaValueArray) {
            return new JavaValueArrayWrapper(jobject);
        } else {
            println("unknown heap object type: " + jobject.getClass());
            return jobject;
        }
    }

    // returns wrapper for Java instances
    function JavaObjectWrapper(instance) {
        var things = instance.fields;
        var fields = instance.clazz.fieldsForInstance;
        var fieldsByName = {};
        for (var i = 0; i < fields.length; ++i) {
            fieldsByName[fields[i].name] = things[i];
        }

        // instance fields can be accessed in natural syntax
        return new JSAdapter() {
            __getIds__ : function() {
                    var res = [];
                    for (var i = 0; i < fields.length; ++i) {
                        res.push(fields[i].name);
                    }
                    return res;
            },
            __has__ : function(name) {
                    return fieldsByName.hasOwnProperty(name) || name == 'class' ||
                           name == 'toString' || name == 'wrapped-object';
            },
            __get__ : function(name) {
                    if (fieldsByName.hasOwnProperty(name)) {
                        return wrapJavaValue(fieldsByName[name]);
                    } else if (name == 'class') {
                        return wrapJavaValue(instance.clazz);
                    } else if (name == 'wrapped-object') {
                        return instance;
                    }

                    return undefined;
            },
            __call__: function(name) {
                if (name == 'toString') {
                    return instance.toString();
                } else {
                    return undefined;
                }
            }
        }
    }


    // return wrapper for Java Class objects
    function JavaClassWrapper(jclass) {
        var fields = jclass.statics;
        var fieldsByName = {};
        for (var i = 0; i < fields.length; ++i) {
            fieldsByName[fields[i].field.name] = fields[i].value;
        }

        // to access static fields of given Class cl, use
        // cl.statics.<static-field-name> syntax
        this.statics = new JSAdapter() {
            __getIds__ : function() {
                var res = [];
                for (var i = 0; i < fields.length; ++i) {
                    res.push(fields[i].field.name);
                }
                return res;
            },
            __has__ : function(name) {
                return fieldsByName.hasOwnProperty(name);
            },
            __get__ : function(name) {
                if (fieldsByName.hasOwnProperty(name)) {
                    return wrapJavaValue(fieldsByName[name]);
                }
                return undefined;
            }
        }

        if (jclass.superclass != null) {
            this.superclass = wrapJavaValue(jclass.superclass);
        } else {
            this.superclass = null;
        }

        this.loader = wrapJavaValue(jclass.getLoader());
        this.signers = wrapJavaValue(jclass.getSigners());
        this.protectionDomain = wrapJavaValue(jclass.getProtectionDomain());
        this.instanceSize = jclass.instanceSize;
        this.name = jclass.name;
        this.fields = jclass.fields;
        this['wrapped-object'] = jclass;
    }

    for (var i in theJavaClassProto) {
        if (typeof theJavaClassProto[i] == 'function') {
            JavaClassWrapper.prototype[i] = theJavaClassProto[i];
        }
    }

    // returns wrapper for Java object arrays
    function JavaObjectArrayWrapper(array) {
        var elements = array.elements;
        // array elements can be accessed in natural syntax
        // also, 'length' property is supported.
        return new JSAdapter() {
            __getIds__ : function() {
                var res = [];
                for (var i = 0; i < elements.length; i++) {
                    res.push(String(i));
                }
                return res;
            },
            __has__: function(name) {
                return (name >= 0 && name < elements.length)  ||
                        name == 'length' || name == 'class' ||
                        name == 'toString' || name == 'wrapped-object';
            },
            __get__ : function(name) {
                if (name >= 0 && name < elements.length) {
                    return wrapJavaValue(elements[name]);
                } else if (name == 'length') {
                    return elements.length;
                } else if (name == 'class') {
                    return wrapJavaValue(array.clazz);
                } else if (name == 'wrapped-object') {
                    return array;
                } else {
                    return undefined;
                }
            },
            __call__: function(name) {
                if (name == 'toString') {
                    return array.toString();
                } else {
                    return undefined;
                }
            }
        }
    }

    // returns wrapper for Java primitive arrays
    function JavaValueArrayWrapper(array) {
        var type = String(java.lang.Character.toString(array.elementType));
        var elements = array.elements;
        // array elements can be accessed in natural syntax
        // also, 'length' property is supported.
        return new JSAdapter() {
            __getIds__ : function() {
                var r = [];
                for (var i = 0; i < array.length; i++) {
                    r.push(String(i));
                }
                return r;
            },
            __has__: function(name) {
                return (name >= 0 && name < array.length) ||
                        name == 'length' || name == 'class' ||
                        name == 'toString' || name == 'wrapped-object';
            },
            __get__: function(name) {
                if (name >= 0 && name < array.length) {
                    return elements[name];
                }

                if (name == 'length') {
                    return array.length;
                } else if (name == 'wrapped-object') {
                    return array;
                } else if (name == 'class') {
                    return wrapJavaValue(array.clazz);
                } else {
                    return undefined;
                }
            },
            __call__: function(name) {
                if (name == 'toString') {
                    return array.valueString(true);
                } else {
                    return undefined;
                }
            }
        }
    }
    return javaObject(thing);
}

// unwrap a script object to corresponding HAT object
function unwrapJavaObject(jobject) {
    if (!(jobject instanceof hatPkg.model.JavaHeapObject)) {
        try {
            jobject = jobject["wrapped-object"];
        } catch (e) {
            println("unwrapJavaObject: " + jobject + ", " + e);
            jobject = undefined;
        }
    }
    return jobject;
}

/**
 * readHeapDump parses a heap dump file and returns script wrapper object.
 *
 * @param file  Heap dump file name
 * @param stack flag to tell if allocation site traces are available
 * @param refs  flag to tell if backward references are needed or not
 * @param debug debug level for HAT
 * @return heap as a JavaScript object
 */
function readHeapDump(file, stack, refs, debug) {

    // default value of debug is 0
    if (!debug) debug = 0;

    // by default, we assume no stack traces
    if (!stack) stack = false;

    // by default, backward references are resolved
    if (!refs) refs = true;

    // read the heap dump
    var heap = hatPkg.parser.HprofReader.readFile(file, stack, debug);

    // resolve it
    heap.resolve(refs);

    // wrap Snapshot as convenient script object
    return wrapHeapSnapshot(heap);
}

/**
 * The result object supports the following methods:
 *
 *  forEachClass  -- calls a callback for each Java Class
 *  forEachObject -- calls a callback for each Java object
 *  findClass -- finds Java Class of given name
 *  findObject -- finds object from given object id
 *  objects -- returns all objects of given class as an iterator
 *  classes -- returns all classes in the heap as an iterator
 *  reachables -- returns all objects reachable from a given object
 *  livepaths -- returns an array of live paths because of which an
 *               object alive.
 *  describeRef -- returns description for a reference from a 'from'
 *              object to a 'to' object.
 */
function wrapHeapSnapshot(heap) {
    function getClazz(clazz) {
        if (clazz == undefined) clazz = "java.lang.Object";
        var type = typeof(clazz);
        if (type == "string") {
            clazz = heap.findClass(clazz);
        } else if (type == "object") {
            clazz = unwrapJavaObject(clazz);
        } else {
            throw new java.lang.IllegalArgumentException("class expected");
        }
        return clazz;
    }

    // return heap as a script object with useful methods.
    return {
        snapshot: heap,

        /**
         * Class iteration: Calls callback function for each
         * Java Class in the heap. Default callback function
         * is 'print'. If callback returns true, the iteration
         * is stopped.
         *
         * @param callback function to be called.
         */
        forEachClass: function(callback) {
            if (callback == undefined) callback = print;
            var classes = this.snapshot.classes.iterator();
            for (var cls in Iterator(classes)) {
                if (callback(wrapJavaValue(cls)))
                    return;
            }
        },

        /**
         * Returns an iterator of all roots.
         */
        roots: function() {
            return wrapperIterator(this.snapshot.roots.iterator(), wrapRoot);
        },

        /**
         * Returns an iterator for all Java classes.
         */
        classes: function() {
            return wrapperIterator(this.snapshot.classes.iterator());
        },

        /**
         * Object iteration: Calls callback function for each
         * Java Object in the heap. Default callback function
         * is 'print'. If callback returns true, the iteration
         * is stopped.
         *
         * @param callback function to be called.
         * @param clazz Class whose objects are retrieved.
         *        Optional, default is 'java.lang.Object'
         * @param includeSubtypes flag to tell if objects of subtypes
         *        are included or not. optional, default is true.
         */
        forEachObject: function(callback, clazz, includeSubtypes) {
            if (includeSubtypes == undefined) includeSubtypes = true;
            if (callback == undefined) callback = print;
            clazz = getClazz(clazz);

            if (clazz) {
                var instances = clazz.getInstances(includeSubtypes).iterator();
                for (var instance in Iterator(instances)) {
                    if (callback(wrapJavaValue(instance)))
                        return;
                }
            }
        },

        /**
         * Returns an iterator of Java objects in the heap.
         *
         * @param clazz Class whose objects are retrieved.
         *        Optional, default is 'java.lang.Object'
         * @param includeSubtypes flag to tell if objects of subtypes
         *        are included or not. optional, default is true.
         * @param where (optional) filter expression or function to
         *        filter the objects. The expression has to return true
         *        to include object passed to it in the result array.
         *        Built-in variable 'it' refers to the current object in
         *        filter expression.
         */
        objects: function(clazz, includeSubtypes, where) {
            if (includeSubtypes == undefined) includeSubtypes = true;
            if (where) {
                if (typeof(where) == 'string') {
                    where = new Function("it", "return " + where);
                }
            }
            clazz = getClazz(clazz);
            if (clazz) {
                var instances = clazz.getInstances(includeSubtypes).iterator();
                if (where) {
                    return filterIterator(instances, where, true);
                } else {
                    return wrapperIterator(instances);
                }
            } else {
                return emptyIterator;
            }
        },

        /**
         * Find Java Class of given name.
         *
         * @param name class name
         */
        findClass: function(name) {
            var clazz = this.snapshot.findClass(name + '');
            return wrapJavaValue(clazz);
        },

        /**
         * Find Java Object from given object id
         *
         * @param id object id as string
         */
        findObject: function(id) {
            return wrapJavaValue(this.snapshot.findThing(id));
        },

        /**
         * Returns an iterator of objects in the finalizer
         * queue waiting to be finalized.
         */
        finalizables: function() {
            var tmp = this.snapshot.getFinalizerObjects().iterator();
            return wrapperIterator(tmp);
        },

        /**
         * Returns an array that contains objects referred from the
         * given Java object directly or indirectly (i.e., all
         * transitively referred objects are returned).
         *
         * @param jobject Java object whose reachables are returned.
         */
        reachables: function (jobject) {
            return reachables(jobject, this.snapshot.reachableExcludes);
        },

        /**
         * Returns array of paths of references by which the given
         * Java object is live. Each path itself is an array of
         * objects in the chain of references. Each path supports
         * toHtml method that returns html description of the path.
         *
         * @param jobject Java object whose live paths are returned
         * @param weak flag to indicate whether to include paths with
         *             weak references or not. default is false.
         */
        livepaths: function (jobject, weak) {
            if (weak == undefined) {
                weak = false;
            }

            function wrapRefChain(refChain) {
                var path = [];

                // compute path array from refChain
                var tmp = refChain;
                while (tmp != null) {
                    var obj = tmp.obj;
                    path.push(wrapJavaValue(obj));
                    tmp = tmp.next;
                }

                function computeDescription(html) {
                    var root = refChain.obj.root;
                    var desc = root.description;
                    var toString = html ? toHtml :
                            function (x) {return x.toString();}
                    if (root.referer) {
                        var ref = root.referer;
                        desc += " (from " + toString(ref) + ')';
                    }
                    desc += '->';
                    var tmp = refChain;
                    while (tmp != null) {
                        var next = tmp.next;
                        var obj = tmp.obj;
                        desc += toString(obj);
                        if (next != null) {
                            desc += " (" +
                                    obj.describeReferenceTo(next.obj, heap)  +
                                    ") ->";
                        }
                        tmp = next;
                    }
                    return desc;
                }

                return new JSAdapter() {
                    __getIds__ : function() {
                        var res = [];
                        for (var i = 0; i < path.length; i++) {
                            res.push(String(i));
                        }
                        return res;
                    },
                    __has__ : function (name) {
                        return (name >= 0 && name < path.length) ||
                            name == 'length' || name == 'toHtml' ||
                            name == 'toString';
                    },
                    __get__ : function(name) {
                        if (name >= 0 && name < path.length) {
                            return path[name];
                        } else if (name == 'length') {
                            return path.length;
                        } else {
                            return undefined;
                        }
                    },
                    __call__: function(name) {
                        if (name == 'toHtml') {
                            return computeDescription(true);
                        } else if (name == 'toString') {
                            return computeDescription(false);
                        } else {
                            return undefined;
                        }
                    }
                };
            }

            jobject = unwrapJavaObject(jobject);
            var refChains = this.snapshot.rootsetReferencesTo(jobject, weak);
            var paths = [];
            for (var i = 0; i < refChains.length; ++i) {
                paths.push(wrapRefChain(refChains[i]));
            }
            return paths;
        },

        /**
         * Return description string for reference from 'from' object
         * to 'to' Java object.
         *
         * @param from source Java object
         * @param to destination Java object
         */
        describeRef: function (from, to) {
            from = unwrapJavaObject(from);
            to = unwrapJavaObject(to);
            return from.describeReferenceTo(to, this.snapshot);
        },
    };
}

// per-object functions

/**
 * Returns allocation site trace (if available) of a Java object
 *
 * @param jobject object whose allocation site trace is returned
 */
function allocTrace(jobject) {
    try {
        jobject = unwrapJavaObject(jobject);
        var trace = jobject.allocatedFrom;
        return (trace != null) ? trace.frames : null;
    } catch (e) {
        println("allocTrace: " + jobject + ", " + e);
        return null;
    }
}

/**
 * Returns Class object for given Java object
 *
 * @param jobject object whose Class object is returned
 */
function classof(jobject) {
    jobject = unwrapJavaObject(jobject);
    return wrapJavaValue(jobject.clazz);
}

/**
 * Find referers (a.k.a in-coming references). Calls callback
 * for each referrer of the given Java object. If the callback
 * returns true, the iteration is stopped.
 *
 * @param callback function to call for each referer
 * @param jobject object whose referers are retrieved
 */
function forEachReferrer(callback, jobject) {
    jobject = unwrapJavaObject(jobject);
    for (var ref in Iterator(jobject.referers.iterator())) {
        if (callback(wrapJavaValue(ref))) {
            return;
        }
    }
}

/**
 * Compares two Java objects for object identity.
 *
 * @param o1, o2 objects to compare for identity
 */
function identical(o1, o2) {
    return objectid(o1) == objectid(o2);
}

/**
 * Returns Java object id as string
 *
 * @param jobject object whose id is returned
 */
function objectid(jobject) {
    try {
        jobject = unwrapJavaObject(jobject);
        return String(jobject.idString);
    } catch (e) {
        println("objectid: " + jobject + ", " + e);
        return null;
    }
}

/**
 * Prints allocation site trace of given object
 *
 * @param jobject object whose allocation site trace is returned
 */
function printAllocTrace(jobject) {
    var frames = this.allocTrace(jobject);
    if (frames == null || frames.length == 0) {
        println("allocation site trace unavailable for " +
              objectid(jobject));
        return;
    }
    println(objectid(jobject) + " was allocated at ..");
    for (var i = 0; i < frames.length; ++i) {
        var frame = frames[i];
        var src = frame.sourceFileName;
        if (src == null) src = '<unknown source>';
        println('\t' + frame.className + "." +
             frame.methodName + '(' + frame.methodSignature + ') [' +
             src + ':' + frame.lineNumber + ']');
    }
}

/**
 * Returns an iterator of referrers of the given Java object.
 *
 * @param jobject Java object whose referrers are returned.
 */
function referrers(jobject) {
    try {
        jobject = unwrapJavaObject(jobject);
        return wrapperIterator(jobject.referers.iterator());
    } catch (e) {
        println("referrers: " + jobject + ", " + e);
        return emptyIterator;
    }
}

/**
 * Returns an array that contains objects referred from the
 * given Java object.
 *
 * @param jobject Java object whose referees are returned.
 */
function referees(jobject) {
    var res = [];
    jobject = unwrapJavaObject(jobject);
    if (jobject != undefined) {
        try {
            jobject.visitReferencedObjects(
                new hatPkg.model.JavaHeapObjectVisitor() {
                    visit: function(other) {
                        res.push(wrapJavaValue(other));
                    },
                    exclude: function(clazz, field) {
                        return false;
                    },
                    mightExclude: function() {
                        return false;
                    }
                });
        } catch (e) {
            println("referees: " + jobject + ", " + e);
        }
    }
    return res;
}

/**
 * Returns an array that contains objects referred from the
 * given Java object directly or indirectly (i.e., all
 * transitively referred objects are returned).
 *
 * @param jobject Java object whose reachables are returned.
 * @param excludes optional comma separated list of fields to be
 *                 removed in reachables computation. Fields are
 *                 written as class_name.field_name form.
 */
function reachables(jobject, excludes) {
    if (excludes == undefined) {
        excludes = null;
    } else if (typeof(excludes) == 'string') {
        var excludedFields = excludes.split(/\s*,\s*/);
        if (excludedFields.length > 0) {
            var excludeSet = {};
            for (var i = 0; i < excludedFields.length; ++i) {
                excludeSet[excludedFields[i]] = 1;
            }
            excludes = new hatPkg.model.ReachableExcludes() {
                        isExcluded: function (field) {
                            return field in excludeSet;
                        }
                    };
        } else {
            // nothing to filter...
            excludes = null;
        }
    } else if (! (excludes instanceof hatPkg.model.ReachableExcludes)) {
        excludes = null;
    }

    jobject = unwrapJavaObject(jobject);
    var ro = new hatPkg.model.ReachableObjects(jobject, excludes);
    return ro.reachables.map(wrapJavaValue);
}


/**
 * Returns whether 'from' object refers to 'to' object or not.
 *
 * @param from Java object that is source of the reference.
 * @param to Java object that is destination of the reference.
 */
function refers(from, to) {
    try {
        var tmp = unwrapJavaObject(from);
        if (tmp instanceof hatPkg.model.JavaClass) {
            from = from.statics;
        } else if (tmp instanceof hatPkg.model.JavaValueArray) {
            return false;
        }
        for (var i in from) {
            if (identical(from[i], to)) {
                return true;
            }
        }
    } catch (e) {
        println("refers: " + from + ", " + e);
    }
    return false;
}

/**
 * If rootset includes given jobject, return Root
 * object explanining the reason why it is a root.
 *
 * @param jobject object whose Root is returned
 */
function root(jobject) {
    try {
        jobject = unwrapJavaObject(jobject);
        return wrapRoot(jobject.root);
    } catch (e) {
        return null;
    }
}

/**
 * Returns size of the given Java object
 *
 * @param jobject object whose size is returned
 */
function sizeof(jobject) {
    try {
        jobject = unwrapJavaObject(jobject);
        return jobject.size;
    } catch (e) {
        println("sizeof: " + jobject + ", " + e);
        return null;
    }
}

/**
 * Returns String by replacing Unicode chars and
 * HTML special chars (such as '<') with entities.
 *
 * @param str string to be encoded
 */
function encodeHtml(str) {
    return hatPkg.util.Misc.encodeHtml(str);
}

/**
 * Returns HTML string for the given object.
 *
 * @param obj object for which HTML string is returned.
 */
function toHtml(obj) {
    if (obj == null) {
        return "null";
    }

    if (obj == undefined) {
        return "undefined";
    }

    var tmp = unwrapJavaObject(obj);
    if (tmp != undefined) {
        var id = tmp.idString;
        if (tmp instanceof hatPkg.model.JavaClass) {
            var name = tmp.name;
            return "<a href='/class/" + id + "'>class " + name + "</a>";
        } else {
            var name = tmp.clazz.name;
            return "<a href='/object/" + id + "'>" +
                   name + "@" + id + "</a>";
        }
    } else if (obj instanceof Object) {
        if (Array.isArray(obj)) {
            // script array
            var res = "[ ";
            for (var i = 0; i < obj.length; ++i) {
                res += toHtml(obj[i]);
                if (i != obj.length - 1) {
                    res += ", ";
                }
            }
            res += " ]";
            return res;
        } else {
            // if the object has a toHtml function property
            // just use that...
            if (typeof(obj.toHtml) == 'function') {
                return obj.toHtml();
            } else {
                // script object
                var res = "{ ";
                for (var i in obj) {
                    res +=  i + ":" + toHtml(obj[i]) + ", ";
                }
                res += "}";
                return res;
            }
        }
    } else {
        // a Java object
        obj = wrapIterable(obj);
        // special case for iterator
        if (obj instanceof java.util.Iterator) {
            var res = "[ ";
            while (obj.hasNext()) {
                res += toHtml(obj.next()) + ", ";
            }
            res += "]";
            return res;
        } else {
            return obj;
        }
    }
}

/*
 * Generic array/iterator [or even object!] manipulation functions. These
 * functions accept an array/iterator and expression String or function.
 * These functions iterate each element of array and apply the expression/
 * function on each element.
 */

// private function to wrap an Iterable as an iterator
function wrapIterable(itr, wrap) {
    if (itr instanceof java.lang.Iterable) {
        var iterator = itr.iterator();
        return wrap ? wrapperIterator(iterator) : iterator;
    } else {
        return itr;
    }
}

/**
 * Converts an iterator/object into an array
 *
 * @param obj iterator/object
 * @return array that contains values of iterator/object
 */
function toArray(obj) {
    obj = wrapIterable(obj);
    if (obj instanceof java.util.Iterator) {
        var res = [];
        while (obj.hasNext()) {
            res.push(obj.next());
        }
        return res;
    } else if (obj instanceof Array) {
        return obj;
    } else {
        var res = [];
        for (var index in obj) {
            res.push(obj[index]);
        }
        return res;
    }
}

/**
 * Returns whether the given array/iterator contains an element that
 * satisfies the given boolean expression specified in code.
 *
 * @param array input array/iterator that is iterated
 * @param code  expression string or function
 * @return boolean result
 *
 * The code evaluated can refer to the following built-in variables.
 *
 * 'it' -> currently visited element
 * 'index' -> index of the current element
 * 'array' -> array that is being iterated
 */
function contains(array, code) {
    array = wrapIterable(array);
    var func = code;
    if (typeof(func) != 'function') {
        func = new Function("it", "index", "array",  "return " + code);
    }

    if (array instanceof java.util.Iterator) {
        var index = 0;
        while (array.hasNext()) {
            var it = array.next();
            if (func(it, index, array)) {
                return true;
            }
            index++;
        }
    } else {
        for (var index = 0; index < array.length; ++index) {
            var it = array[index];
            if (func(it, index, array)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * concatenates two arrays/iterators.
 *
 * @param array1 array/iterator
 * @param array2 array/iterator
 *
 * @return concatenated array or composite iterator
 */
function concat(array1, array2) {
    array1 = wrapIterable(array1);
    array2 = wrapIterable(array2);
    if (array1 instanceof Array && array2 instanceof Array) {
        return array1.concat(array2);
    } else if (array1 instanceof java.util.Iterator &&
               array2 instanceof java.util.Iterator) {
        return com.google.common.collect.Iterators.concat(array1, array2);
    } else {
        return undefined;
    }
}

/**
 * Returns the number of array/iterator elements that satisfy the given
 * boolean expression specified in code. The code evaluated can refer to
 * the following built-in variables.
 *
 * @param array input array/iterator that is iterated
 * @param code  expression string or function
 * @return number of elements
 *
 * 'it' -> currently visited element
 * 'index' -> index of the current element
 * 'array' -> array that is being iterated
 */
function count(array, code) {
    if (code == undefined) {
        return length(array);
    }
    array = wrapIterable(array);
    var func = code;
    if (typeof(func) != 'function') {
        func = new Function("it", "index", "array",  "return " + code);
    }

    var result = 0;
    if (array instanceof java.util.Iterator) {
        var index = 0;
        while (array.hasNext()) {
            var it = array.next();
            if (func(it, index, array)) {
                result++;
            }
            index++;
        }
    } else {
        for (var index = 0; index < array.length; ++index) {
            var it = array[index];
            if (func(it, index, array)) {
                result++;
            }
        }
    }
    return result;
}

/**
 * filter function returns an array/iterator that contains elements of
 * the input array/iterator that satisfy the given boolean expression.
 * The boolean expression code can refer to the following built-in
 * variables.
 *
 * @param array input array/iterator that is iterated
 * @param code  expression string or function
 * @return array/iterator that contains the filtered elements
 *
 * 'it' -> currently visited element
 * 'index' -> index of the current element
 * 'array' -> array that is being iterated
 * 'result' -> result array
 */
function filter(array, code) {
    array = wrapIterable(array);
    var func = code;
    if (typeof(code) != 'function') {
        func = new Function("it", "index", "array", "result", "return " + code);
    }
    if (array instanceof java.util.Iterator) {
        return filterIterator(array, func, false);
    } else {
        var result = [];
        for (var index = 0; index < array.length; ++index) {
            var it = array[index];
            if (func(it, index, array, result)) {
                result.push(it);
            }
        }
        return result;
    }
}

/**
 * Returns the number of elements of array/iterator.
 *
 * @param array input array/iterator that is iterated
 */
function length(array) {
    if (array instanceof java.util.Collection) {
        return array.size();
    }
    array = wrapIterable(array);
    if (array instanceof Array) {
        return array.length;
    } else if (array instanceof java.util.Iterator) {
        var cnt = 0;
        while (array.hasNext()) {
            array.next();
            cnt++;
        }
        return cnt;
    } else {
        var cnt = 0;
        for (var index in array) {
            cnt++;
        }
        return cnt;
    }
}

/**
 * Transforms the given object or array by evaluating given code
 * on each element of the object or array. The code evaluated
 * can refer to the following built-in variables.
 *
 * @param array input array/iterator that is iterated
 * @param code  expression string or function
 * @return array/iterator that contains mapped values
 *
 * 'it' -> currently visited element
 * 'index' -> index of the current element
 * 'array' -> array that is being iterated
 * 'result' -> result array
 *
 * map function returns an array/iterator of values created by
 * repeatedly calling code on each element of the input array/iterator.
 */
function map(array, code) {
    array = wrapIterable(array);
    var func = code;
    if(typeof(code) != 'function') {
        func = new Function("it", "index", "array", "result", "return " + code);
    }

    if (array instanceof java.util.Iterator) {
        var index = 0;
        var result = new java.util.Iterator() {
            hasNext: function() {
                return array.hasNext();
            },
            next: function() {
                return func(array.next(), index++, array, result);
            }
        };
        return result;
    } else {
        var result = [];
        for (var index = 0; index < array.length; ++index) {
            var it = array[index];
            result.push(func(it, index, array, result));
        }
        return result;
    }
}

// private function used by min, max functions
function minmax(array, code) {
    if (typeof(code) == 'string') {
        code = new Function("lhs", "rhs", "return " + code);
    }
    array = wrapIterable(array);
    if (array instanceof java.util.Iterator) {
        if (!array.hasNext()) {
            return undefined;
        }
        var res = array.next();
        while (array.hasNext()) {
            var next = array.next();
            if (code(next, res)) {
                res = next;
            }
        }
        return res;
    } else {
        if (array.length == 0) {
            return undefined;
        }
        var res = array[0];
        for (var index = 1; index < array.length; index++) {
            if (code(array[index], res)) {
                res = array[index];
            }
        }
        return res;
    }
}

/**
 * Returns the maximum element of the array/iterator.
 *
 * @param array input array/iterator that is iterated
 * @param code (optional) comparision expression or function
 *        by default numerical maximum is computed.
 */
function max(array, code) {
    if (code == undefined) {
        code = function (lhs, rhs) { return lhs > rhs; }
    }
    return minmax(array, code);
}

/**
 * Returns the minimum element of the array/iterator.
 *
 * @param array input array/iterator that is iterated
 * @param code (optional) comparision expression or function
 *        by default numerical minimum is computed.
 */
function min(array, code) {
    if (code == undefined) {
        code = function (lhs, rhs) { return lhs < rhs; }
    }
    return minmax(array, code);
}

/**
 * sort function sorts the input array. optionally accepts
 * code to compare the elements. If code is not supplied,
 * numerical sort is done.
 *
 * @param array input array/iterator that is sorted
 * @param code  expression string or function
 * @return sorted array
 *
 * The comparison expression can refer to the following
 * built-in variables:
 *
 * 'lhs' -> 'left side' element
 * 'rhs' -> 'right side' element
 */
function sort(array, code) {
    // we need an array to sort, so convert non-arrays
    array = toArray(array);

    // by default use numerical comparison
    var func = code;
    if (code == undefined) {
        func = function(lhs, rhs) { return lhs - rhs; };
    } else if (typeof(code) == 'string') {
        func = new Function("lhs", "rhs", "return " + code);
    }
    return array.sort(func);
}

/**
 * Returns the sum of the elements of the array
 *
 * @param array input array that is summed.
 * @param code optional expression used to map
 *        input elements before sum.
 */
function sum(array, code) {
    array = wrapIterable(array);
    if (code != undefined) {
        array = map(array, code);
    }
    var result = 0;
    if (array instanceof java.util.Iterator) {
        while (array.hasNext()) {
            result += Number(array.next());
        }
    } else {
        for (var index = 0; index < array.length; ++index) {
            result += Number(array[index]);
        }
    }
    return result;
}

/**
 * Returns array of unique elements from the given input
 * array/iterator.
 *
 * @param array from which unique elements are returned.
 * @param code optional expression (or function) giving unique
 *             attribute/property for each element.
 *             by default, objectid is used for uniqueness.
 */
function unique(array, code) {
    array = wrapIterable(array);
    if (code == undefined) {
        code = objectid;
    } else if (typeof(code) == 'string') {
        code = new Function("it", "return " + code);
    }
    var tmp = {};
    if (array instanceof java.util.Iterator) {
        while (array.hasNext()) {
            var it = array.next();
            tmp[code(it)] = it;
        }
    } else {
        for (var index = 0; index < array.length; ++index) {
            var it = array[index];
            tmp[code(it)] = it;
        }
    }
    var res = [];
    for each (var value in tmp) {
        res.push(value);
    }
    return res;
}
