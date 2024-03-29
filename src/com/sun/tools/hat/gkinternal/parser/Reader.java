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

package com.sun.tools.hat.gkinternal.parser;

import java.io.*;

import com.sun.tools.hat.gkinternal.model.*;

/**
 * Abstract base class for reading object dump files.  A reader need not be
 * thread-safe.
 *
 * @author      Bill Foote
 */


public abstract class Reader {
    protected final PositionDataInputStream in;

    protected Reader(PositionDataInputStream in) {
        this.in = in;
    }

    /**
     * Read a snapshot from a data input stream.  It is assumed that the magic
     * number has already been read.
     */
    abstract public Snapshot read() throws IOException;

    /**
     * Read a snapshot from a file.
     *
     * @param heapFile The name of a file containing a heap dump
     * @param callStack If true, read the call stack of allocaation sites
     */
    public static Snapshot readFile(LoadProgress loadProgress, String heapFile, boolean callStack, int debugLevel) throws IOException {
        int dumpNumber = 1;
        int pos = heapFile.lastIndexOf('#');
        if (pos > -1) {
            String num = heapFile.substring(pos+1, heapFile.length());
            try {
                dumpNumber = Integer.parseInt(num, 10);
            } catch (java.lang.NumberFormatException ex) {
                String msg = "In file name \"" + heapFile
                             + "\", a dump number was "
                             + "expected after the :, but \""
                             + num + "\" was found instead.";
                System.err.println(msg);
                throw new IOException(msg);
            }
            heapFile = heapFile.substring(0, pos);
        }
        try (PositionDataInputStream in = new PositionDataInputStream(
                new BufferedInputStream(new FileInputStream(heapFile)))) {
            loadProgress.startLoadingStream(heapFile, in);
            int i = in.readInt();
            if (i == HprofReader.MAGIC_NUMBER) {
                Reader r
                    = new HprofReader(heapFile, in, dumpNumber,
                                      callStack, debugLevel);
                return r.read();
            } else {
                throw new IOException("Unrecognized magic number: " + i);
            }
        } finally {
            loadProgress.end();
        }
    }
}
