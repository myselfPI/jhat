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

/**
 *
 * @author      Bill Foote
 */


/**
 * Represents a stack trace, that is, an ordered collection of stack frames.
 */

public class StackTrace {

    private final StackFrame[] frames;

    public StackTrace(StackFrame[] frames) {
        this.frames = frames;
    }

    /**
     * @param depth  The minimum reasonable depth is 1.
     *
     * @return a (possibly new) StackTrace that is limited to depth.
     */
    public StackTrace traceForDepth(int depth) {
        if (depth >= frames.length) {
            return this;
        } else {
            StackFrame[] f = new StackFrame[depth];
            System.arraycopy(frames, 0, f, 0, depth);
            return new StackTrace(f);
        }
    }

    public void resolve(Snapshot snapshot) {
        for (StackFrame frame : frames) {
            frame.resolve(snapshot);
        }
    }

    public StackFrame[] getFrames() {
        return frames;
    }
}
