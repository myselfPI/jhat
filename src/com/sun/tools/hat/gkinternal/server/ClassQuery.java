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

package com.sun.tools.hat.gkinternal.server;

import com.google.common.collect.Ordering;
import com.sun.tools.hat.gkinternal.model.*;

import java.util.Arrays;

/**
 *
 * @author      Bill Foote
 */


class ClassQuery extends QueryHandler {
    public ClassQuery() {
    }

    @Override
    public void run() {
        startHtml("Class %s", query);
        JavaClass clazz = snapshot.findClass(query);
        if (clazz == null) {
            error("class not found: %s", query);
        } else {
            printFullClass(clazz);
        }
        endHtml();
    }

    protected void printFullClass(JavaClass clazz) {
        out.print("<h1>");
        print(clazz.toString());
        out.println("</h1>");

        out.println("<h2>Superclass:</h2>");
        printClass(clazz.getSuperclass());

        out.println("<h2>Loader Details</h2>");
        out.println("<h3>ClassLoader:</h3>");
        printThing(clazz.getLoader());

        out.println("<h3>Signers:</h3>");
        printThing(clazz.getSigners());

        out.println("<h3>Protection Domain:</h3>");
        printThing(clazz.getProtectionDomain());

        out.println("<h2>Subclasses:</h2>");
        for (JavaClass sc : clazz.getSubclasses()) {
            out.print("    ");
            printClass(sc);
            out.println("<br>");
        }

        out.println("<h2>Instance Data Members:</h2>");
        Arrays.stream(clazz.getFields()).sorted(Ordering.natural()
                .onResultOf(JavaField::getName)).forEach(f -> {
            out.print("    ");
            printField(f);
            out.println("<br>");
        });

        out.println("<h2>Static Data Members:</h2>");
        JavaStatic[] ss = clazz.getStatics();
        for (JavaStatic s : ss) {
            printStatic(s);
            out.println("<br>");
        }

        out.println("<h2>Instances</h2>");

        printAnchorStart();
        print("instances/" + encodeForURL(clazz));
        out.print("\">");
        out.println("Exclude subclasses</a><br>");

        printAnchorStart();
        print("allInstances/" + encodeForURL(clazz));
        out.print("\">");
        out.println("Include subclasses</a><br>");


        if (snapshot.getHasNewSet()) {
            out.println("<h2>New Instances</h2>");

            printAnchorStart();
            print("newInstances/" + encodeForURL(clazz));
            out.print("\">");
            out.println("Exclude subclasses</a><br>");

            printAnchorStart();
            print("allNewInstances/" + encodeForURL(clazz));
            out.print("\">");
            out.println("Include subclasses</a><br>");
        }

        out.println("<h2>References summary by Type</h2>");
        printAnchorStart();
        print("refsByType/" + encodeForURL(clazz));
        out.print("\">");
        out.println("References summary by type</a>");

        printReferencesTo(clazz);
    }

    protected void printReferencesTo(JavaHeapObject obj) {
        if (obj.getId() == -1) {
            return;
        }
        out.println("<h2>References to this object:</h2>");
        out.flush();
        for (JavaHeapObject ref : obj.getReferers()) {
            printThing(ref);
            print (" : " + ref.describeReferenceTo(obj, snapshot));
            // If there are more than one references, this only gets the
            // first one.
            out.println("<br>");
        }

        out.println("<h2>Other Queries</h2>");
        out.println("Reference Chains from Rootset");
        long id = obj.getId();

        out.print("<ul><li>");
        printAnchorStart();
        out.print("roots/");
        printHex(id);
        out.print("\">");
        out.println("Exclude weak refs</a>");

        out.print("<li>");
        printAnchorStart();
        out.print("allRoots/");
        printHex(id);
        out.print("\">");
        out.println("Include weak refs</a></ul>");

        printAnchorStart();
        out.print("reachableFrom/");
        printHex(id);
        out.print("\">");
        out.println("Objects reachable from here</a><br>");
    }


}
