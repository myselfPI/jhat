/*
 * Copyright (c) 1997, 2008, Oracle and/or its affiliates. All rights reserved.
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

package com.sun.tools.hat.gkinternal.model;

import java.io.IOException;
import com.sun.tools.hat.gkinternal.parser.ReadBuffer;

/**
 * @author      Bill Foote
 */
public class JavaObjectArray extends JavaLazyReadObject {

    private Object clazz;  // Long before resolve, the class after resolve

    public JavaObjectArray(long classID, long offset) {
        super(offset);
        this.clazz = makeId(classID);
    }

    @Override
    public JavaClass getClazz() {
        return (JavaClass) clazz;
    }

    @Override
    public void resolve(Snapshot snapshot) {
        if (clazz instanceof JavaClass) {
            return;
        }
        long classID = getIdValue((Number)clazz);
        if (snapshot.isNewStyleArrayClass()) {
            // Modern heap dumps do this
            JavaThing t = snapshot.findThing(classID);
            if (t instanceof JavaClass) {
                clazz = t;
            }
        }
        if (!(clazz instanceof JavaClass)) {
            JavaThing t = snapshot.findThing(classID);
            if (t != null && t instanceof JavaClass) {
                JavaClass el = (JavaClass) t;
                String nm = el.getName();
                if (!nm.startsWith("[")) {
                    nm = "L" + el.getName() + ";";
                }
                clazz = snapshot.getArrayClass(nm);
            }
        }

        if (!(clazz instanceof JavaClass)) {
            clazz = snapshot.getOtherArrayType();
        }
        ((JavaClass)clazz).addInstance(this);
        super.resolve(snapshot);
    }

    public JavaThing[] getValues() {
        return getElements();
    }

    public JavaThing[] getElements() {
        Snapshot snapshot = getClazz().getSnapshot();
        byte[] data = getValue();
        final int idSize = snapshot.getIdentifierSize();
        final int numElements = data.length / idSize;
        JavaThing[] elements = new JavaThing[numElements];
        int index = 0;
        for (int i = 0; i < elements.length; i++) {
            long id = objectIdAt(index, data);
            index += idSize;
            elements[i] = snapshot.findThing(id);
        }
        return elements;
    }

    @Override
    public int compareTo(JavaThing other) {
        if (other instanceof JavaObjectArray) {
            return 0;
        }
        return super.compareTo(other);
    }

    public int getLength() {
        return getValueLength() / getClazz().getIdentifierSize();
    }

    @Override
    public void visitReferencedObjects(JavaHeapObjectVisitor v) {
        super.visitReferencedObjects(v);
        for (JavaThing element : getElements()) {
            if (element != null && element instanceof JavaHeapObject) {
                v.visit((JavaHeapObject) element);
            }
        }
    }

    /**
     * Describe the reference that this thing has to target.  This will only
     * be called if target is in the array returned by getChildrenForRootset.
     */
    @Override
    public String describeReferenceTo(JavaThing target, Snapshot ss) {
        JavaThing[] elements = getElements();
        for (int i = 0; i < elements.length; i++) {
            if (elements[i] == target) {
                return "Element " + i + " of " + this;
            }
        }
        return super.describeReferenceTo(target, ss);
    }

    /*
     * Java object array record (HPROF_GC_OBJ_ARRAY_DUMP)
     * looks as below:
     *
     *     object ID
     *     stack trace serial number (int)
     *     array length (int)
     *     array class ID
     *     array element IDs
     */
    @Override
    protected final int readValueLength() throws IOException {
        JavaClass cl = getClazz();
        ReadBuffer buf = cl.getReadBuffer();
        int idSize = cl.getIdentifierSize();
        long offset = getOffset() + idSize + 4;
        int len = buf.getInt(offset);
        return len * cl.getIdentifierSize();
    }

    @Override
    protected final byte[] readValue() throws IOException {
        JavaClass cl = getClazz();
        ReadBuffer buf = cl.getReadBuffer();
        int idSize = cl.getIdentifierSize();
        long offset = getOffset() + idSize + 4;
        int len = buf.getInt(offset);
        if (len == 0) {
            return Snapshot.EMPTY_BYTE_ARRAY;
        } else {
            byte[] res = new byte[len * idSize];
            buf.get(offset + 4 + idSize, res);
            return res;
        }
    }
}
